// 悬浮窗搜索脚本
var BANK_PATH = "/sdcard/答题助手题库.json";

function loadBank() {
    try { return JSON.parse(files.read(BANK_PATH)); } catch (e) { return []; }
}

function search(keyword) {
    var bank = loadBank();
    if (!keyword || keyword.length < 1) return [];
    var results = [];
    var kw = String(keyword).toLowerCase();
    for (var i = 0; i < bank.length; i++) {
        var item = bank[i];
        var q = String(item.q || "").toLowerCase();
        if (q.indexOf(kw) >= 0) results.push(item);
    }
    results.sort(function (a, b) {
        return String(a.q || "").length - String(b.q || "").length;
    });
    return results.slice(0, 10);
}

var isExpanded = false;
var searchWin = null;

var w = floaty.rawWindow(
    <frame>
        <card id="btn" w="46" h="46" cardCornerRadius="23" cardBackgroundColor="#333333" cardElevation="6">
            <text id="btnText" text="搜" textColor="#FFFFFF" textSize="16sp" gravity="center" />
        </card>
    </frame>
);

w.btn.click(function () {
    if (isExpanded) {
        collapse();
    } else {
        expand();
    }
});

w.btn.setOnTouchListener(new android.view.View.OnTouchListener({
    onTouch: function (view, event) {
        if (event.getAction() === 0) {
            view.ox = event.getRawX();
            view.oy = event.getRawY();
            view.wx = w.getX();
            view.wy = w.getY();
            view.dragged = false;
            return true;
        }
        if (event.getAction() === 2) {
            var dx = event.getRawX() - view.ox;
            var dy = event.getRawY() - view.oy;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) view.dragged = true;
            if (view.dragged) w.setPosition(view.wx + dx, view.wy + dy);
            return true;
        }
        return true;
    }
}));

function expand() {
    if (searchWin) return;
    isExpanded = true;

    searchWin = floaty.rawWindow(
        <card w="*" cardCornerRadius="10" cardBackgroundColor="#FFFFFF" cardElevation="8" padding="12">
            <vertical>
                <horizontal>
                    <text text="题库搜索" textSize="16sp" textColor="#333333" layout_weight="1" />
                    <text id="closeBtn" text="关闭" textSize="14sp" textColor="#333333" padding="6" />
                </horizontal>
                <input id="searchInput" hint="输入关键词搜索..." textSize="15sp" h="40" marginTop="8" />
                <text id="resultTip" text="" textSize="12sp" textColor="#999999" margin="4 0" />
                <vertical id="resultList" />
            </vertical>
        </card>
    );

    var sw = Math.floor(device.width * 0.9);
    searchWin.setSize(sw, -2);
    searchWin.setPosition(Math.floor((device.width - sw) / 2), 80);
    searchWin.closeBtn.click(collapse);
}

function collapse() {
    isExpanded = false;
    if (searchWin) {
        try { searchWin.close(); } catch (e) { }
        searchWin = null;
    }
}

var lastText = "";
var timerId = setInterval(function () {
    if (!searchWin) return;
    try {
        var txt = String(searchWin.searchInput.getText());
        if (txt !== lastText) {
            lastText = txt;
            doSearch(txt);
        }
    } catch (e) { }
}, 400);

function doSearch(keyword) {
    if (!searchWin) return;
    var results = search(keyword);
    var list = searchWin.resultList;
    try { list.removeAllViews(); } catch (e) { }

    if (results.length === 0) {
        searchWin.resultTip.setText(keyword.length > 0 ? "无匹配" : "");
        return;
    }

    searchWin.resultTip.setText("找到 " + results.length + " 条");
    var ctx = searchWin.getContext();
    var d = ctx.getResources().getDisplayMetrics().density;
    function dp(v) { return Math.floor(v * d); }

    for (var i = 0; i < results.length; i++) {
        var q = String(results[i].q || "");
        var a = String(results[i].a || "");

        var outer = new android.widget.LinearLayout(ctx);
        outer.setOrientation(1);
        outer.setPadding(dp(10), dp(10), dp(10), dp(10));
        var bg = new android.graphics.drawable.GradientDrawable();
        bg.setCornerRadius(dp(6));
        bg.setColor(-986896); // #F0F0F0
        bg.setStroke(1, -12303292); // #BBBBBB
        outer.setBackground(bg);

        var lp = new android.widget.LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(0, 0, 0, dp(8));

        var qTv = new android.widget.TextView(ctx);
        qTv.setText(q);
        qTv.setTextColor(-12303292);
        qTv.setTextSize(13);
        qTv.setMaxLines(3);
        outer.addView(qTv);

        var aTv = new android.widget.TextView(ctx);
        aTv.setText("答案: " + a);
        aTv.setTextColor(-65536); // #FF0000
        aTv.setTextSize(14);
        aTv.setTypeface(null, 1);
        aTv.setPadding(0, dp(6), 0, 0);
        outer.addView(aTv);

        list.addView(outer, lp);
    }
}

events.on("exit", function () {
    clearInterval(timerId);
    collapse();
    w.close();
});
