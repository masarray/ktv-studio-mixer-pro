import QtQuick

Item {
    id: root

    property string title: "GAIN"
    property real value: 0.0
    property real from: -12.0
    property real to: 12.0
    property real defaultValue: 0.0
    property int decimals: 1
    property string unit: "dB"
    property bool logarithmic: false
    property bool compact: false
    property color accentColor: Theme.accent
    property bool enabled: true

    signal valueEdited(real newValue)

    implicitWidth: compact ? 64 : 78
    implicitHeight: compact ? 72 : 90

    property real previewValue: value
    property bool dragging: false
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
        font.letterSpacing: 0.55
    }

    Item {
        id: knobBox
        width: root.compact ? 46 : 56
        height: width
        anchors.top: titleLabel.bottom
        anchors.topMargin: root.compact ? 3 : 5
        anchors.horizontalCenter: parent.horizontalCenter

        Canvas {
            id: dial
            anchors.fill: parent
            antialiasing: true

            onPaint: {
                var ctx = getContext("2d")
                ctx.reset()
                var cx = width / 2
                var cy = height / 2
                var r = width * 0.40
                var start = Math.PI * 0.75
                var sweep = Math.PI * 1.5
                var norm = root.valueToNorm(root.previewValue)
                var end = start + sweep
                var activeEnd = start + sweep * norm

                ctx.lineCap = "round"
                ctx.lineWidth = root.compact ? 2.4 : 2.8
                ctx.strokeStyle = Theme.border.toString()
                ctx.beginPath()
                ctx.arc(cx, cy, r, start, end, false)
                ctx.stroke()

                ctx.strokeStyle = root.enabled ? root.accentColor.toString() : Theme.textDim.toString()
                ctx.beginPath()
                ctx.arc(cx, cy, r, start, activeEnd, false)
                ctx.stroke()

                var capR = r * 0.72
                var g = ctx.createRadialGradient(cx - capR * 0.25, cy - capR * 0.25, 1, cx, cy, capR)
                g.addColorStop(0, "#303842")
                g.addColorStop(0.48, "#20262D")
                g.addColorStop(1, "#11161B")
                ctx.fillStyle = g
                ctx.beginPath()
                ctx.arc(cx, cy, capR, 0, Math.PI * 2)
                ctx.fill()
                ctx.strokeStyle = "#39434D"
                ctx.lineWidth = 1
                ctx.stroke()

                var indicatorAngle = activeEnd
                var inner = capR * 0.23
                var outer = capR * 0.72
                ctx.strokeStyle = root.enabled ? "#F4F8F9" : "#6E7780"
                ctx.lineWidth = 1.7
                ctx.beginPath()
                ctx.moveTo(cx + Math.cos(indicatorAngle) * inner, cy + Math.sin(indicatorAngle) * inner)
                ctx.lineTo(cx + Math.cos(indicatorAngle) * outer, cy + Math.sin(indicatorAngle) * outer)
                ctx.stroke()
            }
        }

        MouseArea {
            id: mouse
            anchors.fill: parent
            enabled: root.enabled
            hoverEnabled: true
            cursorShape: Qt.SizeVerCursor

            onPressed: function(mouseEvent) {
                root.dragging = true
                root.pressY = mouseEvent.y
                root.pressNorm = root.valueToNorm(root.value)
                root.previewValue = root.value
            }

            onPositionChanged: function(mouseEvent) {
                if (!pressed) return
                var fine = (mouseEvent.modifiers & Qt.ShiftModifier) !== 0
                var sensitivity = fine ? 420 : 145
                var nextNorm = root.clamp(root.pressNorm + (root.pressY - mouseEvent.y) / sensitivity, 0, 1)
                root.previewValue = root.normToValue(nextNorm)
                root.valueEdited(root.previewValue)
            }

            onReleased: root.dragging = false
            onCanceled: root.dragging = false
            onDoubleClicked: root.valueEdited(root.defaultValue)

            onWheel: function(wheelEvent) {
                var step = (wheelEvent.modifiers & Qt.ShiftModifier) !== 0 ? 0.002 : 0.012
                var nextNorm = root.clamp(root.valueToNorm(root.value) + (wheelEvent.angleDelta.y > 0 ? step : -step), 0, 1)
                root.previewValue = root.normToValue(nextNorm)
                root.valueEdited(root.previewValue)
                wheelEvent.accepted = true
            }
        }
    }

    Text {
        anchors.top: knobBox.bottom
        anchors.topMargin: root.compact ? 0 : 2
        anchors.horizontalCenter: parent.horizontalCenter
        text: root.formatValue(root.previewValue) + (root.unit.length ? " " + root.unit : "")
        color: root.enabled ? Theme.text : Theme.textDim
        font.family: Theme.fontFamily
        font.pixelSize: root.compact ? Theme.textXS : Theme.textS
        font.weight: Font.DemiBold
    }
}
