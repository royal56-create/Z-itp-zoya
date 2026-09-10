package com.royalankit.zoya.service

import android.Manifest
import android.app.*
import android.content.Intent
import android.content.pm.PackageManager
import android.os.*
import android.speech.*
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.auth.FirebaseAuth
import com.royalankit.zoya.R
import com.royalankit.zoya.ai.GeminiClient
import com.royalankit.zoya.commands.ActionExecutor
import com.royalankit.zoya.commands.CommandRouter
import com.royalankit.zoya.commands.ZoyaCommand
import com.royalankit.zoya.core.SecureStore
import com.royalankit.zoya.memory.HistoryStore
import java.util.Locale

class ZoyaVoiceService:Service(),TextToSpeech.OnInitListener{
    companion object{const val ACTION_START="com.royalankit.zoya.START";const val ACTION_STOP="com.royalankit.zoya.STOP";const val ACTION_STATE="com.royalankit.zoya.STATE";const val EXTRA_TEXT="text";const val EXTRA_STATE="state";private const val CH="zoya_voice";private const val ID=501}
    private var recognizer:SpeechRecognizer?=null;private var tts:TextToSpeech?=null;private val handler=Handler(Looper.getMainLooper());private lateinit var executor:ActionExecutor;private lateinit var history:HistoryStore;private val gemini=GeminiClient();private lateinit var store:SecureStore;private var awake=false;private var running=false;private var restarting=false;private var pending:ZoyaCommand?=null;private var pendingAt=0L
    override fun onCreate(){super.onCreate();executor=ActionExecutor(this);history=HistoryStore(this);store=SecureStore(this);tts=TextToSpeech(this,this);createChannel()}
    override fun onStartCommand(i:Intent?,flags:Int,startId:Int):Int{when(i?.action){ACTION_STOP->{running=false;stopListening();stopSelf();return START_NOT_STICKY};else->{running=true;startForegroundCompat();startListening()}};return START_STICKY}
    private fun startForegroundCompat(){val n=NotificationCompat.Builder(this,CH).setSmallIcon(R.drawable.ic_zoya).setContentTitle(getString(R.string.app_name)).setContentText("Background assistant active — say Zoya").setOngoing(true).setCategory(NotificationCompat.CATEGORY_SERVICE).build();if(Build.VERSION.SDK_INT>=29)startForeground(ID,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)else startForeground(ID,n)}
    private fun createChannel(){if(Build.VERSION.SDK_INT>=26)getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CH,getString(R.string.service_channel),NotificationManager.IMPORTANCE_LOW))}
    private fun startListening(){if(!running||!has(Manifest.permission.RECORD_AUDIO)||!SpeechRecognizer.isRecognitionAvailable(this))return;stopListening();recognizer=SpeechRecognizer.createSpeechRecognizer(this);recognizer?.setRecognitionListener(object:RecognitionListener{
        override fun onReadyForSpeech(p:Bundle?){broadcast("Say Zoya…","listening")};override fun onBeginningOfSpeech(){broadcast("Listening…","listening")};override fun onRmsChanged(v:Float){};override fun onBufferReceived(b:ByteArray?){};override fun onEndOfSpeech(){broadcast("Processing…","processing")};override fun onError(e:Int){restart(700)}
        override fun onPartialResults(b:Bundle?){b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let{if(it.isNotBlank())broadcast(it,"partial")}}
        override fun onResults(b:Bundle?){val text=b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.trim().orEmpty();if(text.isNotBlank())handleSpeech(text);if(running)restart(250)};override fun onEvent(t:Int,p:Bundle?){}
    });val intent=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply{putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);putExtra(RecognizerIntent.EXTRA_LANGUAGE,"hi-IN");putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,3)};try{recognizer?.startListening(intent)}catch(_:Exception){restart(1000)}}
    private fun handleSpeech(raw:String){val norm=raw.lowercase(Locale.ROOT);val wakes=listOf("zoya","ज़ोया","जोया","joya");val wake=wakes.firstOrNull{norm.startsWith(it)};if(!awake&&wake==null)return;val command=if(awake)raw else raw.substring(wake!!.length).trim(' ',',','.','!','?',':','।');if(!awake){awake=true;broadcast("जी बॉस, बोलिए।","awake")};if(command.isBlank()){speak("जी बॉस, बोलिए।");return};awake=false;handleCommand(command)}
    private fun handleCommand(text:String){
        broadcast(text,"command")
        val normalized=text.trim().lowercase(Locale.ROOT)
        val p=pending
        if(p!=null && System.currentTimeMillis()-pendingAt < 60_000){
            if(normalized in listOf("हाँ","हां","haan","han","yes","yes please","confirm","ok","okay","करो","कर दीजिए","भेजो","भेज दें")){
                pending=null
                executor.execute(p, true){r->recordAndSpeak(text,r)}
                return
            }
            if(normalized in listOf("नहीं","नही","nahi","no","cancel","cancel करो","मत करो")){
                pending=null
                speak("ठीक है, action cancel कर दिया।")
                return
            }
            pending=null
        } else pending=null

        val parsed=CommandRouter.parse(text)
        if(parsed is ZoyaCommand.Unknown){
            val uid=try{FirebaseAuth.getInstance().currentUser?.uid}catch(_:Exception){null}
            if(uid==null){speak("पहले Google login कर लीजिए।");return}
            val key=store.getApiKey(uid)
            if(key.isNullOrBlank()){speak("Gemini API key profile में save कर दीजिए।");return}
            val memory=history.memoryContext(uid,text)
            val model=store.getModel(uid).orEmpty()
            if(model.isBlank()){
                gemini.listModels(key){models,err->
                    val selected=models.filter{it.methods.any{m->m.contains("generateContent",true)}}
                        .sortedBy{if(it.name.contains("flash",true))0 else 1}.firstOrNull()?.name
                    if(selected==null){speak("Gemini model नहीं मिला। API key या quota check करें।");return@listModels}
                    store.putModel(uid,selected);askGemini(key,selected,text,memory,uid)
                }
            } else askGemini(key,model,text,memory,uid)
            return
        }
        executor.execute(parsed){r->handleResult(text,parsed,r)}
    }

    private fun askGemini(key:String,model:String,text:String,memory:String,uid:String){
        gemini.generate(key,model,text,memory){reply,err->handler.post{
            if(reply==null){speak("Gemini request में समस्या हुई। API key या quota check करें।");return@post}
            val action=reply.action
            if(action!=null){
                val c=commandFromJson(action)
                if(c!=null) executor.execute(c){r->handleResult(text,c,r)}
                else {history.add(uid,"voice",text,reply.text);speak(reply.text)}
            } else {history.add(uid,"voice",text,reply.text);broadcast(reply.text,"success");speak(reply.text)}
        }}
    }

    private fun handleResult(source:String,command:ZoyaCommand,result:ActionExecutor.Result){
        val uid=try{FirebaseAuth.getInstance().currentUser?.uid.orEmpty()}catch(_:Exception){""}
        if(result.needsConfirmation){
            pending=command;pendingAt=System.currentTimeMillis()
            broadcast(result.message,"confirmation")
            speak(result.message)
            return
        }
        history.add(uid,"voice",source,result.message)
        broadcast(result.message,if(result.ok)"success" else "notice")
        speak(result.message)
    }

    private fun recordAndSpeak(source:String,result:ActionExecutor.Result){
        val uid=try{FirebaseAuth.getInstance().currentUser?.uid.orEmpty()}catch(_:Exception){""}
        history.add(uid,"voice",source,result.message)
        broadcast(result.message,if(result.ok)"success" else "notice")
        speak(result.message)
    }
    private fun commandFromJson(a:org.json.JSONObject):ZoyaCommand?{return when(a.optString("type")){"call"->ZoyaCommand.Call(a.optString("target"));"sms"->ZoyaCommand.Sms(a.optString("target"),a.optString("body"));"whatsapp"->ZoyaCommand.WhatsApp(a.optString("target"),a.optString("body"));"open_app"->ZoyaCommand.OpenApp(a.optString("target"));"type_text"->ZoyaCommand.TypeText(a.optString("body"));"web_search"->ZoyaCommand.WebSearch(a.optString("target"));"youtube"->ZoyaCommand.Youtube(a.optString("target"));"spotify"->ZoyaCommand.Spotify(a.optString("target"));"read_messages"->ZoyaCommand.ReadMessages;"camera"->ZoyaCommand.Camera;"location"->ZoyaCommand.Location;"flashlight"->ZoyaCommand.Flashlight;"timer"->ZoyaCommand.Timer(a.optLong("seconds"));"alarm"->ZoyaCommand.Alarm(a.optInt("hour"),a.optInt("minute"));"share_text"->ZoyaCommand.ShareText(a.optString("body"));"email"->ZoyaCommand.Email(a.optString("target").ifBlank{null},a.optString("subject").ifBlank{null},a.optString("body"));else->null}}
    private fun restart(ms:Long){if(restarting||!running)return;restarting=true;handler.postDelayed({restarting=false;if(running)startListening()},ms)}
    private fun stopListening(){recognizer?.cancel();recognizer?.destroy();recognizer=null}
    private fun speak(s:String){tts?.speak(s,TextToSpeech.QUEUE_FLUSH,null,"zoya_${System.currentTimeMillis()}")}
    private fun broadcast(t:String,state:String){sendBroadcast(Intent(ACTION_STATE).setPackage(packageName).putExtra(EXTRA_TEXT,t).putExtra(EXTRA_STATE,state))}
    private fun has(p:String)=ContextCompat.checkSelfPermission(this,p)==PackageManager.PERMISSION_GRANTED
    override fun onInit(status:Int){if(status==TextToSpeech.SUCCESS){tts?.language=Locale("hi","IN");tts?.setSpeechRate(1f);tts?.setPitch(1f)}}
    override fun onDestroy(){running=false;stopListening();tts?.stop();tts?.shutdown();super.onDestroy()}
    override fun onBind(i:Intent?)=null
}
