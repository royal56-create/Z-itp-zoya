package com.royalankit.zoya.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import android.view.animation.LinearInterpolator

/** Lightweight animated Royal-style orbital frame. The supplied logo remains stationary. */
class RoyalOrbitalView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private var angle = 0f
    private val animator = ValueAnimator.ofFloat(0f, 360f).apply {
        duration = 7000L
        repeatCount = ValueAnimator.INFINITE
        interpolator = LinearInterpolator()
        addUpdateListener { angle = it.animatedValue as Float; invalidate() }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (!animator.isStarted) animator.start()
    }

    override fun onDetachedFromWindow() {
        animator.cancel()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val cx = width / 2f
        val cy = height / 2f
        val radius = (minOf(width, height) * 0.43f).coerceAtLeast(1f)
        val oval = RectF(cx - radius, cy - radius, cx + radius, cy + radius)

        paint.strokeWidth = 3f
        paint.alpha = 180
        paint.color = 0xFFFF3030.toInt()
        canvas.drawArc(oval, angle, 210f, false, paint)

        paint.strokeWidth = 2f
        paint.alpha = 140
        paint.color = 0xFF49E7FF.toInt()
        canvas.drawArc(oval, angle + 210f, 120f, false, paint)

        paint.strokeWidth = 1.5f
        paint.alpha = 100
        paint.color = 0xFFFF8BC4.toInt()
        canvas.drawArc(oval, angle + 330f, 30f, false, paint)
    }
}
