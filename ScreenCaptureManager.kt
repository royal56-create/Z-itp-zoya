package com.royalankit.zoya.service

import android.content.Context
import android.graphics.Bitmap
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.WindowManager
import java.io.ByteArrayOutputStream

class ScreenCaptureManager(private val context:Context){
    private var display:VirtualDisplay?=null;private var reader:ImageReader?=null;private var projection:MediaProjection?=null
    fun capture(p:MediaProjection,done:(ByteArray?)->Unit){projection=p;val wm=context.getSystemService(WindowManager::class.java);val metrics=DisplayMetrics();@Suppress("DEPRECATION") wm.defaultDisplay.getRealMetrics(metrics);val w=metrics.widthPixels;val h=metrics.heightPixels;reader=ImageReader.newInstance(w,h,android.graphics.PixelFormat.RGBA_8888,2);display=p.createVirtualDisplay("ZoyaVision",w,h,metrics.densityDpi,DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,reader!!.surface,null,null);Handler(Looper.getMainLooper()).postDelayed({val image=reader?.acquireLatestImage();if(image==null){cleanup();done(null);return@postDelayed};val plane=image.planes[0];val bmp=Bitmap.createBitmap(w+(plane.rowStride-plane.pixelStride*w)/plane.pixelStride,h,Bitmap.Config.ARGB_8888);bmp.copyPixelsFromBuffer(plane.buffer);image.close();val cropped=Bitmap.createBitmap(bmp,0,0,w,h);bmp.recycle();val out=ByteArrayOutputStream();cropped.compress(Bitmap.CompressFormat.JPEG,80,out);cropped.recycle();cleanup();done(out.toByteArray())},300)}
    fun cleanup(){display?.release();display=null;reader?.close();reader=null;projection?.stop();projection=null}
}
