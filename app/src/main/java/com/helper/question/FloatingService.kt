package com.helper.question

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*

/**
 * 悬浮窗服务 - 在任意App上层显示搜索框
 * 输入关键词 → 实时搜索本地题库 → 展示匹配的题目和答案
 */
class FloatingService : Service() {

    private lateinit var windowManager: WindowManager
    private lateinit var floatView: View
    private lateinit var db: QuestionDatabase
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var isExpanded = false
    private var screenWidth = 0
    private var screenHeight = 0

    // 悬浮窗组件
    private lateinit var collapseBtn: TextView        // 收起状态的小圆点
    private lateinit var expandLayout: LinearLayout   // 展开状态的完整面板
    private lateinit var searchInput: EditText        // 搜索框
    private lateinit var resultList: LinearLayout     // 结果列表
    private lateinit var resultCount: TextView        // 结果计数
    private lateinit var toggleBtn: TextView          // 展开/收起按钮

    // 拖拽相关
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false
    private var dragThreshold = 10f

    companion object {
        const val CHANNEL_ID = "floating_service"
        const val NOTIFICATION_ID = 1001
        var isRunning = false
    }

    override fun onCreate() {
        super.onCreate()
        db = QuestionDatabase(this)
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()

        val dm = resources.displayMetrics
        screenWidth = dm.widthPixels
        screenHeight = dm.heightPixels
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        if (floatView.parent == null) {
            createFloatingWindow()
        }
        isRunning = true
        return START_STICKY
    }

    // ===== 悬浮窗创建 =====

    @SuppressLint("ClickableViewAccessibility")
    private fun createFloatingWindow() {
        val inflater = getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater
        floatView = inflater.inflate(R.layout.floating_window, null)

        // 获取组件引用
        collapseBtn = floatView.findViewById(R.id.collapseBtn)
        expandLayout = floatView.findViewById(R.id.expandLayout)
        searchInput = floatView.findViewById(R.id.searchInput)
        resultList = floatView.findViewById(R.id.resultList)
        resultCount = floatView.findViewById(R.id.resultCount)
        toggleBtn = floatView.findViewById(R.id.toggleBtn)

        // 初始状态：收起（只显示小圆点）
        collapseBtn.visibility = View.VISIBLE
        expandLayout.visibility = View.GONE

        val params = WindowManager.LayoutParams().apply {
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            format = PixelFormat.TRANSLUCENT
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
            width = WindowManager.LayoutParams.WRAP_CONTENT
            height = WindowManager.LayoutParams.WRAP_CONTENT
            gravity = Gravity.TOP or Gravity.START
            x = screenWidth - dp(50)
            y = screenHeight / 3
        }

        windowManager.addView(floatView, params)

        // === 事件绑定 ===

        // 点击小圆点 → 展开
        collapseBtn.setOnClickListener {
            if (!isDragging) expand()
        }

        // 拖拽移动
        collapseBtn.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = getParams().x
                    initialY = getParams().y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
                        isDragging = true
                    }
                    if (isDragging) {
                        val p = getParams()
                        p.x = (initialX + dx).toInt()
                        p.y = (initialY + dy).toInt()
                        windowManager.updateViewLayout(floatView, p)
                    }
                    true
                }
                else -> false
            }
        }

        // 搜索框实时搜索
        searchInput.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                performSearch(s?.toString() ?: "")
            }
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        })

        // 键盘搜索键
        searchInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                performSearch(searchInput.text.toString())
                true
            } else false
        }

        // 切换收起/展开
        toggleBtn.setOnClickListener { collapse() }
    }

    // ===== 展开/收起 =====

    private fun expand() {
        collapseBtn.visibility = View.GONE
        expandLayout.visibility = View.VISIBLE

        // 切换为全宽面板
        val p = getParams()
        p.width = (screenWidth * 0.92).toInt()
        p.flags = p.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
        // 居中
        p.x = ((screenWidth - p.width) / 2)
        windowManager.updateViewLayout(floatView, p)

        isExpanded = true
        searchInput.requestFocus()

        // 弹出键盘
        scope.launch {
            delay(200)
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(searchInput, InputMethodManager.SHOW_IMPLICIT)
        }
    }

    private fun collapse() {
        // 隐藏键盘
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(searchInput.windowToken, 0)

        collapseBtn.visibility = View.VISIBLE
        expandLayout.visibility = View.GONE

        val p = getParams()
        p.width = WindowManager.LayoutParams.WRAP_CONTENT
        p.flags = p.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        // 保持在当前位置
        windowManager.updateViewLayout(floatView, p)

        isExpanded = false
        searchInput.text?.clear()
        resultList.removeAllViews()
    }

    // ===== 搜索 =====

    private fun performSearch(keyword: String) {
        if (keyword.isBlank()) {
            resultList.removeAllViews()
            resultCount.text = ""
            return
        }

        scope.launch(Dispatchers.IO) {
            // 先FTS全文搜索，再LIKE兜底
            val ftsResults = db.search(keyword)
            val results = if (ftsResults.isNotEmpty()) {
                ftsResults
            } else {
                db.searchLike(keyword)
            }

            withContext(Dispatchers.Main) {
                displayResults(results)
            }
        }
    }

    private fun displayResults(results: List<QuestionItem>) {
        resultList.removeAllViews()

        if (results.isEmpty()) {
            resultCount.text = "未找到匹配题目，请尝试其他关键词"
            return
        }

        resultCount.text = "找到 ${results.size} 条结果"

        val inflater = LayoutInflater.from(this)

        for (item in results) {
            val card = inflater.inflate(R.layout.search_result_item, resultList, false)

            card.findViewById<TextView>(R.id.tvQuestion).text = item.question
            card.findViewById<TextView>(R.id.tvOptions).let { tv ->
                if (item.options.isNotEmpty()) {
                    tv.text = "选项: ${item.options}"
                    tv.visibility = View.VISIBLE
                } else {
                    tv.visibility = View.GONE
                }
            }
            card.findViewById<TextView>(R.id.tvAnswer).text = "✓ 答案: ${item.answer}"

            // 点击该项 → 自动收起悬浮窗，方便用户回到原界面答题
            card.setOnClickListener { collapse() }

            resultList.addView(card)
        }
    }

    // ===== 辅助 =====

    private fun getParams(): WindowManager.LayoutParams {
        return floatView.layoutParams as WindowManager.LayoutParams
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "答题助手悬浮窗",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "悬浮窗运行中"
                setShowBadge(false)
            }
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("答题助手")
            .setContentText("悬浮窗已开启，点击输入关键词搜索答案")
            .setSmallIcon(android.R.drawable.ic_menu_search)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        if (::floatView.isInitialized && floatView.parent != null) {
            windowManager.removeView(floatView)
        }
        isRunning = false
        super.onDestroy()
    }
}
