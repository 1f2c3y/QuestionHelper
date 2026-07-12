// 悬浮窗搜索
var BANK_PATH = "/sdcard/答题助手题库.json";

function loadBank() {
    try {
        var arr = JSON.parse(files.read(BANK_PATH));
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

function val2str(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (v.q && v.a) return val2str(v.q);
    try { return JSON.stringify(v); } catch (e) { return "[?]"; }
}

function search(kw) {
    var bank = loadBank();
    if (!kw || kw.length < 1) return [];
    var k = kw.toLowerCase().trim();
    if (k.length < 1) return [];
    var r = [];
    for (var i = 0; i < bank.length; i++) {
        if (val2str(bank[i].q).toLowerCase().indexOf(k) >= 0) r.push(bank[i]);
    }
    r.sort(function (a, b) { return val2str(a.q).length - val2str(b.q).length; });
    return r.slice(0, 8);
}

var searchWin = null;
var isOpen = false;
var downX, downY, winX, winY, moved;

var btn = floaty.rawWindow(
    <frame>
        <card id="mainCard" w="auto" h="auto" cardCornerRadius="20" cardBackgroundColor="#333333" cardElevation="8">
            <text text="搜" textColor="#FFFFFF" textSize="15sp" gravity="center" padding="10 14" />
        </card>
    </frame>
);

btn.mainCard.setOnTouchListener(function (v, e) {
    if (e.getAction() === 0) {
        downX = e.getRawX();
        downY = e.getRawY();
        winX = btn.getX();
        winY = btn.getY();
        moved = false;
        return true;
    }
    if (e.getAction() === 2) {
        var dx = e.getRawX() - downX;
        var dy = e.getRawY() - downY;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
        if (moved) btn.setPosition(winX + dx, winY + dy);
        return true;
    }
    if (e.getAction() === 1 && !moved) {
        toggle();
        return true;
    }
    return true;
});

function toggle() {
    if (isOpen) { doClose(); } else { doOpen(); }
}

function doOpen() {
    if (searchWin) return;
    isOpen = true;
    searchWin = floaty.rawWindow(
        <card w="*" cardCornerRadius="10" cardBackgroundColor="#FFFFFF" cardElevation="12" padding="12">
            <vertical>
                <horizontal>
                    <text text="搜索题库" textSize="16sp" textColor="#333333" layout_weight="1" />
                    <text id="closeBtn" text="关闭" textSize="14sp" textColor="#333333" padding="8 4" />
                </horizontal>
                <input id="searchInp" hint="输入关键词..." textSize="15sp" h="40" marginTop="6" />
                <text id="hintText" text="" textSize="11sp" textColor="#999999" margin="2 0" />
                <vertical id="resultList" />
            </vertical>
        </card>
    );
    var sw = Math.floor(device.width * 0.9);
    searchWin.setSize(sw, -2);
    searchWin.setPosition(Math.floor((device.width - sw) / 2), 80);
    searchWin.closeBtn.click(doClose);
}

function doClose() {
    isOpen = false;
    if (searchWin) { try { searchWin.close(); } catch (e) { } searchWin = null; }
}

var lastTxt = "";
var tid = setInterval(function () {
    if (!searchWin) return;
    try {
        var t = String(searchWin.searchInp.getText()).trim();
        if (t !== lastTxt) { lastTxt = t; render(t); }
    } catch (e) { }
}, 350);

function render(kw) {
    if (!searchWin) return;
    try { searchWin.resultList.removeAllViews(); } catch (e) { }
    if (!kw || kw.length < 1) { searchWin.hintText.setText(""); return; }
    var rs = search(kw);
    if (rs.length === 0) { searchWin.hintText.setText("无匹配"); return; }
    searchWin.hintText.setText("找到 " + rs.length + " 条");

    var ctx = searchWin.resultList.getContext();
    var d = ctx.getResources().getDisplayMetrics().density;
    for (var i = 0; i < rs.length; i++) {
        var q = val2str(rs[i].q);
        var a = val2str(rs[i].a);
        if (q.length > 55) q = q.substring(0, 55) + "...";
        var c = new android.widget.LinearLayout(ctx);
        c.setOrientation(1);
        c.setPadding(dp(10, d), dp(10, d), dp(10, d), dp(10, d));
        var bg = new android.graphics.drawable.GradientDrawable();
        bg.setCornerRadius(dp(6, d));
        bg.setColor(-986896);
        bg.setStroke(1, -12303292);
        c.setBackground(bg);
        var p = new android.widget.LinearLayout.LayoutParams(-1, -2);
        p.setMargins(0, 0, 0, dp(8, d));
        var qt = new android.widget.TextView(ctx);
        qt.setText(q);
        qt.setTextColor(-12303292);
        qt.setTextSize(13);
        qt.setMaxLines(3);
        c.addView(qt);
        var at = new android.widget.TextView(ctx);
        at.setText("答案: " + a);
        at.setTextColor(-65536);
        at.setTextSize(14);
        at.setTypeface(null, 1);
        at.setPadding(0, dp(6, d), 0, 0);
        c.addView(at);
        searchWin.resultList.addView(c, p);
    }
}

function dp(v, d) { return Math.floor(v * d); }

events.on("exit", function () { clearInterval(tid); doClose(); btn.close(); });
