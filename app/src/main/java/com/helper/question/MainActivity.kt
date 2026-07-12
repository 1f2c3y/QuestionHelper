package com.helper.question

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {

    private lateinit var db: QuestionDatabase
    private lateinit var tvBankCount: TextView
    private lateinit var tvOcrStatus: TextView
    private lateinit var switchFloating: SwitchCompat
    private lateinit var btnImport: Button

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // 图片选择器
    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { processImage(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        db = QuestionDatabase(this)

        tvBankCount = findViewById(R.id.tvBankCount)
        tvOcrStatus = findViewById(R.id.tvOcrStatus)
        switchFloating = findViewById(R.id.switchFloating)
        btnImport = findViewById(R.id.btnImport)

        // 刷新题库计数
        refreshBankCount()

        // 同步悬浮窗开关状态
        switchFloating.isChecked = FloatingService.isRunning

        // 导入截图按钮
        btnImport.setOnClickListener {
            if (!checkStoragePermission()) {
                requestStoragePermission()
            } else {
                pickImage()
            }
        }

        // 悬浮窗开关
        switchFloating.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                    // 需要悬浮窗权限
                    Toast.makeText(this, "请先授予悬浮窗权限", Toast.LENGTH_LONG).show()
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivity(intent)
                    switchFloating.isChecked = false
                } else {
                    startFloatingService()
                }
            } else {
                stopFloatingService()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // 用户从设置页面返回后，重新检查悬浮窗权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (Settings.canDrawOverlays(this) && !FloatingService.isRunning) {
                switchFloating.isChecked = false
            }
        }
        refreshBankCount()
    }

    // ===== 存储权限 =====

    private fun checkStoragePermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) ==
                    PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) ==
                    PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requestStoragePermission() {
        val perm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_IMAGES
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }
        requestPermissions(arrayOf(perm), 100)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 100 && grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            pickImage()
        }
    }

    // ===== 图片选择与OCR =====

    private fun pickImage() {
        pickImageLauncher.launch("image/*")
    }

    private fun processImage(uri: Uri) {
        tvOcrStatus.text = "正在OCR识别..."
        btnImport.isEnabled = false

        scope.launch(Dispatchers.IO) {
            try {
                val image = InputImage.fromFilePath(this@MainActivity, uri)
                val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())

                val result = withContext(Dispatchers.Main) {
                    // ML Kit 的 process 是异步的，使用 Tasks.await()
                    com.google.android.gms.tasks.Tasks.await(recognizer.process(image))
                }

                val fullText = result.text
                if (fullText.isBlank()) {
                    withContext(Dispatchers.Main) {
                        tvOcrStatus.text = "未识别到文字，请确保截图清晰"
                        btnImport.isEnabled = true
                    }
                    return@launch
                }

                // 解析题目和答案
                val parsed = parseQuestionAnswer(fullText)
                val count = parsed.size

                if (count == 0) {
                    withContext(Dispatchers.Main) {
                        tvOcrStatus.text = "未能解析出题目-答案对\n识别文本预览: ${fullText.take(150)}..."
                        btnImport.isEnabled = true
                    }
                    return@launch
                }

                // 存入数据库
                var saved = 0
                for ((question, answer, options) in parsed) {
                    if (question.isNotBlank() && answer.isNotBlank()) {
                        db.insert(question, answer, options, "OCR导入")
                        saved++
                    }
                }

                withContext(Dispatchers.Main) {
                    tvOcrStatus.text = "导入完成！识别 $count 道题，成功保存 $saved 道"
                    refreshBankCount()
                    btnImport.isEnabled = true

                    // 显示识别预览
                    showImportPreview(parsed)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    tvOcrStatus.text = "识别失败: ${e.message}"
                    btnImport.isEnabled = true
                }
            }
        }
    }

    /**
     * 从OCR识别文本中解析题目和答案
     * 支持的格式：
     *   题目：xxxxx
     *   答案：B / 正确答案：B / ✓B
     *   选项：A.xxx B.xxx C.xxx D.xxx
     */
    private fun parseQuestionAnswer(text: String): List<Triple<String, String, String>> {
        val results = mutableListOf<Triple<String, String, String>>()
        val lines = text.split("\n").map { it.trim() }.filter { it.isNotBlank() }

        var currentQuestion = StringBuilder()
        var currentOptions = StringBuilder()
        var currentAnswer = ""
        var inQuestion = false

        // 答案匹配模式
        val answerPatterns = listOf(
            Regex("""答案\s*[：:]\s*([A-Da-d])"""),
            Regex("""正确答案\s*[：:]\s*([A-Da-d])"""),
            Regex("""正确选项\s*[：:]\s*([A-Da-d])"""),
            Regex("""[✓✔√]\s*([A-Da-d])"""),
            Regex("""^([A-Da-d])\s*[.。、）\)]?\s*(.+)$"""),  // "B. 正确答案文本"
        )

        for (line in lines) {
            // 检测答案行
            var foundAnswer = false
            for (pattern in answerPatterns) {
                val m = pattern.find(line)
                if (m != null) {
                    currentAnswer = m.groupValues[1].uppercase()
                    // 如果这一行同时包含题目文本（如 "B. 正确答案"模式）
                    if (pattern.pattern.contains("(.+)") && m.groupValues.size > 2) {
                        val answerText = m.groupValues[2].trim()
                        if (answerText.length > 5) {
                            currentQuestion.append(" ").append(answerText)
                        }
                    }
                    foundAnswer = true
                    break
                }
            }

            if (foundAnswer) {
                // 保存当前题目-答案对
                if (currentQuestion.isNotBlank() && currentAnswer.isNotBlank()) {
                    results.add(
                        Triple(
                            currentQuestion.toString().trim(),
                            currentAnswer,
                            currentOptions.toString().trim()
                        )
                    )
                }
                // 重置
                currentQuestion = StringBuilder()
                currentOptions = StringBuilder()
                currentAnswer = ""
                inQuestion = false
                continue
            }

            // 检测选项行（A.xxx / B、xxx）
            if (Regex("""^[A-Da-d]\s*[.。、）\)]\s*.+""").matches(line)) {
                if (currentOptions.isNotEmpty()) currentOptions.append(" | ")
                currentOptions.append(line)
                inQuestion = true
                continue
            }

            // 检测新题目开始（包含"题"、数字序号、或较长文本）
            if (Regex("""^(\d+[.、）\)]|\d{1,2}[套组])""").matches(line) ||
                line.length > 10 && !line.startsWith("A") && !line.startsWith("B") &&
                !line.startsWith("C") && !line.startsWith("D")
            ) {
                // 如果之前有未保存的题目
                if (currentQuestion.isNotBlank() && currentAnswer.isNotBlank()) {
                    results.add(
                        Triple(
                            currentQuestion.toString().trim(),
                            currentAnswer,
                            currentOptions.toString().trim()
                        )
                    )
                }
                currentQuestion = StringBuilder(line)
                currentOptions = StringBuilder()
                currentAnswer = ""
                inQuestion = true
                continue
            }

            // 普通文本行，追加到题目或选项
            if (inQuestion) {
                if (line.length > 3) {
                    currentQuestion.append(" ").append(line)
                }
            }
        }

        // 处理最后一道题
        if (currentQuestion.isNotBlank() && currentAnswer.isNotBlank()) {
            results.add(
                Triple(
                    currentQuestion.toString().trim(),
                    currentAnswer,
                    currentOptions.toString().trim()
                )
            )
        }

        return results
    }

    // ===== UI =====

    private fun refreshBankCount() {
        tvBankCount.text = "${db.count} 道"
    }

    private fun showImportPreview(parsed: List<Triple<String, String, String>>) {
        // 简单Toast展示前3道题
        val preview = parsed.take(3).joinToString("\n\n") { (q, a, o) ->
            "题: ${q.take(40)}...\n答: $a${if (o.isNotEmpty()) " | $o" else ""}"
        }
        if (parsed.size > 3) {
            Toast.makeText(this, "$preview\n\n...共${parsed.size}道", Toast.LENGTH_LONG).show()
        } else if (parsed.isNotEmpty()) {
            Toast.makeText(this, preview, Toast.LENGTH_LONG).show()
        }
    }

    // ===== 悬浮窗服务 =====

    private fun startFloatingService() {
        val intent = Intent(this, FloatingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        switchFloating.isChecked = true
        Toast.makeText(this, "悬浮窗已开启", Toast.LENGTH_SHORT).show()
    }

    private fun stopFloatingService() {
        stopService(Intent(this, FloatingService::class.java))
        switchFloating.isChecked = false
        Toast.makeText(this, "悬浮窗已关闭", Toast.LENGTH_SHORT).show()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
