import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root

    property real threshold: -18
    property real ratio: 3.0
    property real attack: 12
    property real release: 140
    property real gainReduction: 4.7

    implicitHeight: 250
    radius: Theme.radiusLarge
    color: Theme.panel
    border.width: 1
    border.color: Theme.border

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
    function inputToX(db, w) { return (db + 60) / 60 * w }
    function outputToY(db, h) { return h - (db + 60) / 60 * h }
    function outputFor(inputDb) {
        if (inputDb <= threshold) return inputDb
        return threshold + (inputDb - threshold) / Math.max(1, ratio)
    }

    onThresholdChanged: graph.requestPaint()
    onRatioChanged: graph.requestPaint()

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 24

            Text {
                text: "COMPRESSOR"
                color: Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textM
                font.weight: Font.DemiBold
                font.letterSpacing: 0.55
            }

            Item { Layout.fillWidth: true }

            Rectangle {
                width: 74
                height: 24
                radius: Theme.radiusSmall
                color: Theme.accentFaint
                border.width: 1
                border.color: Theme.borderSoft
                Row {
                    anchors.centerIn: parent
                    spacing: 5
                    Text {
                        text: "GR"
                        color: Theme.textDim
                        font.family: Theme.fontFamily
                        font.pixelSize: 9
                        font.weight: Font.DemiBold
                    }
                    Text {
                        text: "−" + root.gainReduction.toFixed(1) + " dB"
                        color: Theme.amber
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.textXS
                        font.weight: Font.DemiBold
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumHeight: 98
            radius: Theme.radius
            color: "#0A0E11"
            border.width: 1
            border.color: Theme.borderSoft

            Repeater {
                model: 5
                delegate: Rectangle {
                    required property int index
                    width: 1
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    x: index * parent.width / 4
                    color: "#1D252C"
                }
            }
            Repeater {
                model: 5
                delegate: Rectangle {
                    required property int index
                    height: 1
                    anchors.left: parent.left
                    anchors.right: parent.right
                    y: index * parent.height / 4
                    color: "#1D252C"
                }
            }

            Canvas {
                id: graph
                anchors.fill: parent
                anchors.margins: 8
                antialiasing: true

                onPaint: {
                    var ctx = getContext("2d")
                    ctx.reset()

                    ctx.strokeStyle = "#46515B"
                    ctx.lineWidth = 1
                    ctx.setLineDash([4, 4])
                    ctx.beginPath()
                    ctx.moveTo(0, height)
                    ctx.lineTo(width, 0)
                    ctx.stroke()
                    ctx.setLineDash([])

                    ctx.beginPath()
                    for (var i = 0; i <= 120; ++i) {
                        var input = -60 + i / 120 * 60
                        var output = root.outputFor(input)
                        var x = root.inputToX(input, width)
                        var y = root.outputToY(output, height)
                        if (i === 0) ctx.moveTo(x, y)
                        else ctx.lineTo(x, y)
                    }
                    ctx.strokeStyle = Theme.amber.toString()
                    ctx.lineWidth = 2.1
                    ctx.lineJoin = "round"
                    ctx.stroke()

                    var tx = root.inputToX(root.threshold, width)
                    var ty = root.outputToY(root.threshold, height)
                    ctx.fillStyle = Theme.amber.toString()
                    ctx.beginPath()
                    ctx.arc(tx, ty, 4.2, 0, Math.PI * 2)
                    ctx.fill()
                }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 70
            spacing: 2

            StudioKnob {
                Layout.fillWidth: true
                compact: true
                title: "THRESH"
                value: root.threshold
                from: -48; to: 0; defaultValue: -18
                decimals: 1; unit: "dB"
                accentColor: Theme.amber
                onValueEdited: function(v) { root.threshold = v }
            }
            StudioKnob {
                Layout.fillWidth: true
                compact: true
                title: "RATIO"
                value: root.ratio
                from: 1; to: 12; defaultValue: 3
                decimals: 1; unit: ":1"
                accentColor: Theme.amber
                onValueEdited: function(v) { root.ratio = v }
            }
            StudioKnob {
                Layout.fillWidth: true
                compact: true
                title: "ATTACK"
                value: root.attack
                from: 1; to: 120; defaultValue: 12
                logarithmic: true
                decimals: 0; unit: "ms"
                accentColor: Theme.amber
                onValueEdited: function(v) { root.attack = v }
            }
            StudioKnob {
                Layout.fillWidth: true
                compact: true
                title: "RELEASE"
                value: root.release
                from: 30; to: 1200; defaultValue: 140
                logarithmic: true
                decimals: 0; unit: "ms"
                accentColor: Theme.amber
                onValueEdited: function(v) { root.release = v }
            }
        }
    }
}
