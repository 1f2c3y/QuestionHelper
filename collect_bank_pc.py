"""
学习强企 PC微信小程序 题库采集脚本
使用前：pip install pyautogui pillow pytesseract opencv-python
       并安装 Tesseract-OCR (https://github.com/UB-Mannheim/tesseract/wiki)
"""

import pyautogui
import pytesseract
from PIL import Image
import time
import os
import json
import re

# ============ 配置（首次使用需校准） ============
CONFIG_FILE = "config.json"
OUTPUT_FILE = "题库.txt"

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def calibrate(config=None):
    """让用户框选微信小程序窗口区域，自动计算题目区、答案区、按钮区"""
    print("\n=== 校准步骤 ===")
    print("1. 确保微信小程序窗口可见")
    print("2. 用鼠标在左上角和右下角各点一下框住小程序窗口")
    print("3. 每次点击后有3秒时间移动鼠标")
    print()

    for i in range(2):
        print(f"请将鼠标移到小程序窗口的{'左上角' if i == 0 else '右下角'}，3秒后自动记录...")
        time.sleep(3)
        x, y = pyautogui.position()
        print(f"  已记录: ({x}, {y})")
        if i == 0:
            left, top = x, y
        else:
            right, bottom = x, y

    width = right - left
    height = bottom - top

    # 按比例划分区域
    # 题目区：上部 40%
    # 答案区：中部 30%
    # 按钮区：底部 20%
    config = {
        "left": left,
        "top": top,
        "width": width,
        "height": height,
        "question_box": [left, top + int(height * 0.08), left + width, top + int(height * 0.45)],
        "answer_box": [left, top + int(height * 0.35), left + width, top + int(height * 0.80)],
        "next_btn": [left + int(width * 0.85), top + int(height * 0.93)],
    }

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    print(f"\n校准完成。窗口大小: {width}x{height}")
    print(f"题目区: {config['question_box']}")
    print(f"答案区: {config['answer_box']}")
    print(f"下一题按钮: {config['next_btn']}")
    print(f"已保存到 {CONFIG_FILE}")
    return config

def crop_and_ocr(region):
    """截取指定区域并 OCR"""
    x1, y1, x2, y2 = region
    img = pyautogui.screenshot(region=(x1, y1, x2 - x1, y2 - y1))
    # 放大 2x 提高 OCR 准确率
    img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    text = pytesseract.image_to_string(img, lang="chi_sim")
    return text.strip()

def clean_question(text):
    """清洗题目文字"""
    lines = text.split("\n")
    # 过滤太短的行和纯数字行
    cleaned = [l.strip() for l in lines if len(l.strip()) > 2 and not l.strip().isdigit()]
    return "".join(cleaned)

def extract_answer(text):
    """从 OCR 结果中提取答案"""
    # 匹配 "正确答案：X" 或 "正确答案: X" 或类似格式
    patterns = [
        r"正确答案[：:]\s*([A-H])",
        r"答案[：:]\s*([A-H])",
        r"正确[：:]\s*([A-H])",
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            return f"正确答案：{m.group(1)}"
    # 没匹配到就返回原文第一行
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    return lines[0] if lines else ""

def get_question_type(text):
    """从 OCR 结果判断题型"""
    for t in ["判断题", "判断", "单选题", "单选", "多选题", "多选", "填空题", "填空"]:
        if t in text:
            if "判断" in t: return "判断"
            if "单选" in t: return "单选"
            if "多选" in t: return "多选"
            if "填空" in t: return "填空"
    return "未知"

def main():
    config = load_config()
    if config is None:
        config = calibrate()
        if config is None:
            return

    # 加载已采集
    done = set()
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        done.update(re.findall(r"\[.\] (.+?)\n", content))

    print(f"\n已采集 {len(done)} 题")
    print("按 Ctrl+C 停止\n")

    # 确保 Tesseract 路径（Windows 默认安装路径）
    if os.name == "nt":
        tesseract_paths = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ]
        for p in tesseract_paths:
            if os.path.exists(p):
                pytesseract.pytesseract.tesseract_cmd = p
                break

    count = len(done)
    stale = 0
    last_q = ""

    try:
        while count < 1600:
            time.sleep(1.5)

            # 截取并 OCR
            raw_q = crop_and_ocr(config["question_box"])
            q = clean_question(raw_q)
            raw_a = crop_and_ocr(config["answer_box"])
            a = extract_answer(raw_a)

            # 检查题目是否有效
            if len(q) < 5:
                stale += 1
                if stale > 5:
                    print("连续读不到题目，可能已结束")
                    break
                time.sleep(1)
                continue

            # 检查是否重复
            if q == last_q:
                stale += 1
                if stale > 3:
                    print("题目不再变化，可能已到底")
                    break
                time.sleep(0.5)
                continue

            stale = 0
            last_q = q

            # 去重
            q_key = q[:30]
            if q_key in done:
                pyautogui.click(config["next_btn"][0], config["next_btn"][1])
                time.sleep(0.8)
                continue

            # 获取题型
            qtype = get_question_type(raw_q)
            if qtype != "未知":
                raw_q = raw_q.replace(qtype, "", 1)

            # 写入
            entry = f"[{qtype}] {q}\n{a}\n\n"
            with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
                f.write(entry)
            done.add(q_key)
            count += 1

            print(f"{count}/1505  [{qtype}] {q[:40]}... → {a}")

            # 下一题
            pyautogui.click(config["next_btn"][0], config["next_btn"][1])
            time.sleep(0.8)

    except KeyboardInterrupt:
        print(f"\n用户停止，共采集 {count} 题")

    print(f"结果保存在: {os.path.abspath(OUTPUT_FILE)}")

if __name__ == "__main__":
    main()
