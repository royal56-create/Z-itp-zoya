package com.royalankit.zoya.commands

import java.util.Locale

object CommandRouter {
    fun parse(raw:String):ZoyaCommand {
        val s=raw.trim().replace(Regex("\\s+")," "); val l=s.lowercase(Locale.ROOT)
        Regex("(?:call|कॉल|फोन)\\s+(.+)").matchEntire(s)?.let { return ZoyaCommand.Call(it.groupValues[1]) }
        Regex("(?:send|भेजो|भेज)\\s+(?:sms|message|मैसेज)\\s+(?:to|ko|को)\\s+(.+?)\\s+(?:saying|that|likho|लिखो|लिख)\\s+(.+)",RegexOption.IGNORE_CASE).matchEntire(s)?.let { return ZoyaCommand.Sms(it.groupValues[1],it.groupValues[2]) }
        Regex("(?:send|भेजो|भेज)\\s+(?:whatsapp|व्हाट्सऐप|वॉट्सऐप)\\s+(?:message|msg|मैसेज)?\\s*(?:to|ko|को)\\s+(.+?)\\s+(?:saying|that|likho|लिखो|लिख)\\s+(.+)",RegexOption.IGNORE_CASE).matchEntire(s)?.let { return ZoyaCommand.WhatsApp(it.groupValues[1],it.groupValues[2]) }
        Regex("(?:type|write|likho|लिखो|टाइप करो)\\s+(.+)",RegexOption.IGNORE_CASE).matchEntire(s)?.let { return ZoyaCommand.TypeText(it.groupValues[1]) }
        Regex("(?:click|tap|press|क्लिक|दबाओ|टैप)\\s+(.+)",RegexOption.IGNORE_CASE).matchEntire(s)?.let { return ZoyaCommand.ClickText(it.groupValues[1]) }
        Regex("(?:scroll|स्क्रॉल)\\s+(up|down|left|right|ऊपर|नीचे|बाएँ|दाएँ)",RegexOption.IGNORE_CASE).matchEntire(s)?.let {
            val d=when(it.groupValues[1].lowercase(Locale.ROOT)){"ऊपर"->"up";"नीचे"->"down";"बाएँ"->"left";"दाएँ"->"right";else->it.groupValues[1]}
            return ZoyaCommand.Scroll(d)
        }
        Regex("(?:open|visit|खोलो|खोल)\\s+(https?://\\S+)",RegexOption.IGNORE_CASE).matchEntire(s)?.let { return ZoyaCommand.OpenUrl(it.groupValues[1]) }
        Regex("(?:open|launch|start|khol|kholo|खोलो|खोल)\\s+(.+?)(?:\\s+app)?$",RegexOption.IGNORE_CASE).matchEntire(s)?.let { return ZoyaCommand.OpenApp(it.groupValues[1]) }
        Regex("(?:search|google|खोजो|सर्च)\\s+(.+)",RegexOption.IGNORE_CASE).matchEntire(s)?.let { return ZoyaCommand.WebSearch(it.groupValues[1]) }
        Regex("(?:play|search|चलाओ|खोजो)\\s+(.+?)\\s+(?:on\\s+)?youtube$",RegexOption.IGNORE_CASE).matchEntire(s)?.let { return ZoyaCommand.Youtube(it.groupValues[1]) }
        Regex("(?:play|search|चलाओ|खोजो)\\s+(.+?)\\s+(?:on\\s+)?spotify$",RegexOption.IGNORE_CASE).matchEntire(s)?.let { return ZoyaCommand.Spotify(it.groupValues[1]) }
        Regex("(?:set\\s+)?timer\\s+(\\d+)\\s*(seconds?|minutes?|hours?|सेकंड|मिनट|घंटे?)",RegexOption.IGNORE_CASE).matchEntire(s)?.let { val n=it.groupValues[1].toLong(); val u=it.groupValues[2].lowercase(); return ZoyaCommand.Timer(if(u.startsWith("hour")||u.startsWith("घंट"))n*3600 else if(u.startsWith("min"))n*60 else n) }
        Regex("(?:set\\s+)?alarm\\s+(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?",RegexOption.IGNORE_CASE).matchEntire(s)?.let { var h=it.groupValues[1].toInt(); val m=it.groupValues[2].ifBlank{"0"}.toInt(); if(it.groupValues[3].equals("pm",true)&&h<12)h+=12; if(it.groupValues[3].equals("am",true)&&h==12)h=0; return ZoyaCommand.Alarm(h,m) }
        if(l.contains("message")&&l.contains("read")||l=="मैसेज पढ़ो"||l=="messages padho")return ZoyaCommand.ReadMessages
        if(l.contains("camera")||l.contains("कैमरा"))return ZoyaCommand.Camera
        if(l.contains("location")||l.contains("मैं कहाँ")||l.contains("लोकेशन"))return ZoyaCommand.Location
        if(l.contains("flashlight")||l.contains("torch")||l.contains("टॉर्च"))return ZoyaCommand.Flashlight
        return ZoyaCommand.Unknown
    }
}
