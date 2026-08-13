import QtQuick

Item {
    id: root

    property string title: "GAIN"
    property real value: 0.0
    property real from: -12.0
    property real to: 12.0
    property real defaultValue: 0.0
    property int decimals: 1
    property real step: 0
    property string unit: "dB"
    property bool logarithmic: false
    property bool compact: false
    property color accentColor: Theme.accent
    signal valueEdited(real newValue)

    implicitWidth: compact ? 70 : 84
    implicitHeight: compact ? 76 : 94

    property real previewValue: value
    property bool dragging: false
    property bool hovered: pointer.containsMouse
    property real pressY: 0
    property real pressNorm: 0

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
    function valueToNorm(v) {
        if (logarithmic) {
            var safeFrom = Math.max(0.0001, from)
            var safeValue = Math.max(safeFrom, v)
            return clamp(Math.log(safeValue / safeFrom) / Math.log(to / safeFrom), 0, 1)
        }
        return clamp((v - from) / (to - from), 0, 1)
    }
    function normToValue(n) {
        n = clamp(n, 0, 1)
        if (logarithmic) {
            var safeFrom = Math.max(0.0001, from)
            return safeFrom * Math.pow(to / safeFrom, n)
        }
        return from + n * (to - from)
    }
    function formatValue(v) {
        if (logarithmic && unit === "Hz" && v >= 1000)
            return (v / 1000).toFixed(v >= 10000 ? 1 : 2) + "k"
        return Number(v).toFixed(decimals)
    }
    function effectiveStep(fine) {
        var base = step > 0 ? step : Math.max((to - from) / 100, Math.pow(10, -decimals))
        return fine ? base / 10 : base
    }
    function quantize(v, fine) {
        var s = effectiveStep(fine)
        var next = clamp(Math.round(v / s) * s, from, to)
        return Number(next.toFixed(Math.max(decimals + 1, 3)))
    }
    function nudge(direction, fine) {
        var next = quantize(value + direction * effectiveStep(fine), fine)
        previewValue = next
        valueEdited(next)
    }

    activeFocusOnTab: true
    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Up || event.key === Qt.Key_Right) {
            nudge(1, (event.modifiers & Qt.ShiftModifier) !== 0)
            event.accepted = true
        } else if (event.key === Qt.Key_Down || event.key === Qt.Key_Left) {
            nudge(-1, (event.modifiers & Qt.ShiftModifier) !== 0)
            event.accepted = true
        } else if (event.key === Qt.Key_Home) {
            previewValue = defaultValue
            valueEdited(defaultValue)
            event.accepted = true
        }
    }

    onValueChanged: if (!dragging) previewValue = value
    onPreviewValueChanged: dial.requestPaint()
    onAccentColorChanged: dial.requestPaint()

    Text {
        id: titleLabel
        anchors.top: parent.top
        anchors.horizontalCenter: parent.horizontalCenter
        text: root.title
        color: Theme.textDim
        font.family: Theme.fontFamily
        font.pixelSize: Theme.textXS
        font.weight: Font.DemiBold
        font.letterSpacing: 0.6
    }

    Item {
        id: knobBox
        width: root.compact ? 48 : 58
        height: width
        anchors.top: titleLabel.bottom
        anchors.topMargin: root.compact ? 3 : 5
        anchors.horizontalCenter: parent.horizontalCenter

        Rectangle {
            anchors.centerIn: parent
            width: parent.width * 0.82
            height: width
            radius: width / 2
            color: "#080B0E"
            border.width: 1
            border.color: root.activeFocus ? Theme.focus : root.hovered ? Theme.highlight : "#26313A"
            Behavior on border.color { ColorAnimation { duration: 80 } }
        }

        Canvas {
            id: dial
            anchors.fill: parent
            antialiasing: true
            onPaint: {
                var ctx = getContext("2d")
                ctx.reset()
                var cx = width / 2
                var cy = height / 2
                var norm = root.valueToNorm(root.previewValue)
                var start = Math.PI * 0.75
                var sweep = Math.PI * 1.5
                var end = start + sweep
                var activeEnd = start + sweep * norm
                var arcR = width * 0.43

                ctx.lineCap = "round"
                ctx.lineWidth = root.compact ? 2.1 : 2.6
                ctx.strokeStyle = "#2A343E"
                ctx.beginPath(); ctx.arc(cx, cy, arcR, start, end, false); ctx.stroke()

                ctx.strokeStyle = root.accentColor.toString()
                ctx.beginPath(); ctx.arc(cx, cy, arcR, start, activeEnd, false); ctx.stroke()

                for (var i = 0; i < 11; ++i) {
                    var a = start + sweep * i / 10
                    var r1 = arcR + 4
                    var r2 = arcR + (i === 5 ? 7 : 6)
                    ctx.strokeStyle = i === 5 ? "#73808A" : "#3A4650"
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
                    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2)
                    ctx.stroke()
                }

                var capR = width * 0.29
                var g = ctx.createRadialGradient(cx - capR * 0.35, cy - capR * 0.42, 2, cx, cy, capR)
                g.addColorStop(0, "#44505A")
                g.addColorStop(0.22, "#2E3740")
                g.addColorStop(0.72, "#171D23")
                g.addColorStop(1, "#0E1318")
                ctx.fillStyle = g
                ctx.beginPath(); ctx.arc(cx, cy, capR, 0, Math.PI * 2); ctx.fill()
                ctx.strokeStyle = "#4B5864"; ctx.lineWidth = 1; ctx.stroke()

                var a2 = activeEnd
                ctx.strokeStyle = "#F4F7F9"
                ctx.lineWidth = root.compact ? 1.6 : 1.8
                ctx.beginPath()
                ctx.moveTo(cx + Math.cos(a2) * capR * 0.18, cy + Math.sin(a2) * capR * 0.18)
                ctx.lineTo(cx + Math.cos(a2) * capR * 0.76, cy + Math.sin(a2) * capR * 0.76)
                ctx.stroke()
            }
        }

        MouseArea {
            id: pointer
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.SizeVerCursor
            onPressed: function(e) {
                root.forceActiveFocus()
                root.dragging = true
                root.pressY = e.y
                root.pressNorm = root.valueToNorm(root.value)
                root.previewValue = root.value
            }
            onPositionChanged: function(e) {
                if (!pressed) return
                var fine = (e.modifiers & Qt.ShiftModifier) !== 0
                var sensitivity = fine ? 420 : 145
                var nextNorm = root.clamp(root.pressNorm + (root.pressY - e.y) / sensitivity, 0, 1)
                root.previewValue = root.quantize(root.normToValue(nextNorm), fine)
                root.valueEdited(root.previewValue)
            }
            onReleased: root.dragging = false
            onCanceled: root.dragging = false
            onDoubleClicked: {
                root.previewValue = root.defaultValue
                root.valueEdited(root.defaultValue)
            }
            onWheel: function(e) {
                root.forceActiveFocus()
                root.nudge(e.angleDelta.y > 0 ? 1 : -1, (e.modifiers & Qt.ShiftModifier) !== 0)
                e.accepted = true
            }
        }
    }

    Rectangle {
        anchors.top: knobBox.bottom
        anchors.topMargin: root.compact ? 0 : 1
        anchors.horizontalCenter: parent.horizontalCenter
        width: root.compact ? 64 : 76
        height: root.compact ? 18 : 20
        radius: 4
        color: "#090D11"
        border.width: 1
        border.color: root.dragging ? root.accentColor : root.activeFocus ? Theme.focus : root.hovered ? Theme.highlight : Theme.borderSoft

        Text {
            anchors.centerIn: parent
            text: root.formatValue(root.previewValue) + (root.unit.length ? " " + root.unit : "")
            color: root.dragging || root.activeFocus ? Theme.text : Theme.textSoft
            font.family: Theme.fontFamily
            font.pixelSize: root.compact ? Theme.textXS : Theme.textS
            font.weight: Font.DemiBold
        }
    }

    Text {
        visible: root.hovered && !root.compact
        anchors.top: parent.bottom
        anchors.topMargin: 2
        anchors.horizontalCenter: parent.horizontalCenter
        text: "WHEEL  ·  SHIFT FINE"
        color: Theme.textFaint
        font.family: Theme.fontFamily
        font.pixelSize: 7
        font.letterSpacing: 0.35
    }
}
