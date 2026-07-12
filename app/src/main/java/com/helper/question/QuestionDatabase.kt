package com.helper.question

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * 本地题库 - SQLite + FTS5 全文搜索
 */
class QuestionDatabase(context: Context) : SQLiteOpenHelper(
    context, DB_NAME, null, DB_VERSION
) {
    companion object {
        private const val DB_NAME = "question_bank.db"
        private const val DB_VERSION = 1
        private const val TABLE = "questions"
        private const val FTS_TABLE = "questions_fts"
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE $TABLE (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                options TEXT DEFAULT '',
                source TEXT DEFAULT '',
                created_at INTEGER DEFAULT (strftime('%s','now'))
            )
        """.trimIndent())

        // FTS5 虚拟表，支持中文分词搜索
        db.execSQL("""
            CREATE VIRTUAL TABLE $FTS_TABLE USING fts5(
                question, answer, options,
                content='$TABLE',
                content_rowid='id',
                tokenize='unicode61'
            )
        """.trimIndent())

        // 触发器：插入/更新/删除时同步FTS
        db.execSQL("""
            CREATE TRIGGER fts_insert AFTER INSERT ON $TABLE BEGIN
                INSERT INTO $FTS_TABLE(rowid, question, answer, options)
                VALUES (new.id, new.question, new.answer, new.options);
            END
        """.trimIndent())

        db.execSQL("""
            CREATE TRIGGER fts_delete AFTER DELETE ON $TABLE BEGIN
                INSERT INTO $FTS_TABLE($FTS_TABLE, rowid, question, answer, options)
                VALUES ('delete', old.id, old.question, old.answer, old.options);
            END
        """.trimIndent())

        db.execSQL("""
            CREATE TRIGGER fts_update AFTER UPDATE ON $TABLE BEGIN
                INSERT INTO $FTS_TABLE($FTS_TABLE, rowid, question, answer, options)
                VALUES ('delete', old.id, old.question, old.answer, old.options);
                INSERT INTO $FTS_TABLE(rowid, question, answer, options)
                VALUES (new.id, new.question, new.answer, new.options);
            END
        """.trimIndent())
    }

    override fun onUpgrade(db: SQLiteDatabase, oldV: Int, newV: Int) {
        db.execSQL("DROP TABLE IF EXISTS $FTS_TABLE")
        db.execSQL("DROP TABLE IF EXISTS $TABLE")
        onCreate(db)
    }

    // ===== 题库操作 =====

    fun insert(question: String, answer: String, options: String = "", source: String = ""): Long {
        val cv = ContentValues().apply {
            put("question", question)
            put("answer", answer)
            put("options", options)
            put("source", source)
        }
        return writableDatabase.insert(TABLE, null, cv)
    }

    fun delete(id: Long) {
        writableDatabase.delete(TABLE, "id=?", arrayOf(id.toString()))
    }

    fun getCount(): Int {
        val c = readableDatabase.rawQuery("SELECT COUNT(*) FROM $TABLE", null)
        c.moveToFirst()
        return c.getInt(0).also { c.close() }
    }

    /**
     * FTS5 全文搜索
     * 输入关键词，返回匹配的题目+答案列表，按相关度排序
     */
    fun search(keyword: String): List<QuestionItem> {
        if (keyword.isBlank()) return emptyList()
        val db = readableDatabase
        val items = mutableListOf<QuestionItem>()

        // 对中文关键词做字符拆分，适配FTS unicode61分词
        val ftsQuery = buildFtsQuery(keyword)

        val sql = """
            SELECT q.id, q.question, q.answer, q.options
            FROM $FTS_TABLE f
            JOIN $TABLE q ON q.id = f.rowid
            WHERE $FTS_TABLE MATCH ?
            ORDER BY rank
            LIMIT 20
        """.trimIndent()

        val cursor: Cursor = db.rawQuery(sql, arrayOf(ftsQuery))
        while (cursor.moveToNext()) {
            items.add(
                QuestionItem(
                    id = cursor.getLong(0),
                    question = cursor.getString(1),
                    answer = cursor.getString(2),
                    options = cursor.getString(3)
                )
            )
        }
        cursor.close()
        return items
    }

    /**
     * 模糊搜索 (LIKE) - FTS5查不到时的兜底
     */
    fun searchLike(keyword: String): List<QuestionItem> {
        if (keyword.isBlank()) return emptyList()
        val items = mutableListOf<QuestionItem>()
        val cursor = readableDatabase.query(
            TABLE,
            arrayOf("id", "question", "answer", "options"),
            "question LIKE ?",
            arrayOf("%$keyword%"),
            null, null,
            "id DESC",
            "20"
        )
        while (cursor.moveToNext()) {
            items.add(
                QuestionItem(
                    id = cursor.getLong(0),
                    question = cursor.getString(1),
                    answer = cursor.getString(2),
                    options = cursor.getString(3)
                )
            )
        }
        cursor.close()
        return items
    }

    /** 获取全部题目（用于导出/展示） */
    fun getAll(): List<QuestionItem> {
        val items = mutableListOf<QuestionItem>()
        val cursor = readableDatabase.query(
            TABLE,
            arrayOf("id", "question", "answer", "options"),
            null, null, null, null,
            "id DESC"
        )
        while (cursor.moveToNext()) {
            items.add(
                QuestionItem(
                    id = cursor.getLong(0),
                    question = cursor.getString(1),
                    answer = cursor.getString(2),
                    options = cursor.getString(3)
                )
            )
        }
        cursor.close()
        return items
    }

    /** 将中文关键词拆分为FTS5查询表达式 */
    private fun buildFtsQuery(keyword: String): String {
        // 去掉空格和特殊字符
        val cleaned = keyword.replace(Regex("""[\s，。！？、""''《》（）【】；：,.!?\"'()\[\]{};:]"""), "")
        if (cleaned.isEmpty()) return keyword
        // 每个字符之间加空格，形成 AND 查询
        val chars = cleaned.toCharArray()
        return chars.joinToString(" ") { "\"$it\"" }
    }


}

data class QuestionItem(
    val id: Long,
    val question: String,
    val answer: String,
    val options: String = ""
)
