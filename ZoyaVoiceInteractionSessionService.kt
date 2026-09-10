package com.royalankit.zoya.service

import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

class ZoyaVoiceInteractionSessionService:VoiceInteractionSessionService(){override fun onNewSession(args:android.os.Bundle?):VoiceInteractionSession=ZoyaVoiceSession(this)}
class ZoyaVoiceSession(service:VoiceInteractionSessionService):VoiceInteractionSession(service)
