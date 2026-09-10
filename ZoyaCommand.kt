package com.royalankit.zoya.commands

sealed interface ZoyaCommand {
    data class Call(val target:String): ZoyaCommand
    data class Sms(val target:String,val body:String): ZoyaCommand
    data class WhatsApp(val target:String,val body:String): ZoyaCommand
    data class OpenApp(val name:String): ZoyaCommand
    data class TypeText(val text:String): ZoyaCommand
    data class ClickText(val text:String): ZoyaCommand
    data class OpenUrl(val url:String): ZoyaCommand
    data class Scroll(val direction:String): ZoyaCommand
    data class WebSearch(val query:String): ZoyaCommand
    data class Youtube(val query:String): ZoyaCommand
    data class Spotify(val query:String): ZoyaCommand
    data class Timer(val seconds:Long): ZoyaCommand
    data class Alarm(val hour:Int,val minute:Int): ZoyaCommand
    data object ReadMessages: ZoyaCommand
    data object Camera: ZoyaCommand
    data object Location: ZoyaCommand
    data object Flashlight: ZoyaCommand
    data class ShareText(val text:String): ZoyaCommand
    data class Email(val to:String?,val subject:String?,val body:String): ZoyaCommand
    data object Unknown: ZoyaCommand
}
