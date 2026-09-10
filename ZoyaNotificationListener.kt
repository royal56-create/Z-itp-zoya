package com.royalankit.zoya.service

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.CopyOnWriteArrayList

class ZoyaNotificationListener:NotificationListenerService(){
    data class Item(val app:String,val title:String,val text:String,val ts:Long)
    companion object{private val items=CopyOnWriteArrayList<Item>();fun recent(limit:Int)=items.sortedByDescending{it.ts}.take(limit)}
    override fun onNotificationPosted(sbn:StatusBarNotification){val e=sbn.notification.extras;val title=e.getCharSequence("android.title")?.toString().orEmpty();val text=e.getCharSequence("android.text")?.toString().orEmpty();if(title.isBlank()&&text.isBlank())return;items.add(Item(sbn.packageName,title,text,System.currentTimeMillis()));while(items.size>100)items.removeAt(0)}
}
