import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root

    property real threshold: -18.0
    property real ratio: 3.0
    property real attack: 12
    property real release: 140
    property real makeup: 1.5
    property real gainReduction: -4.7

    implicitHeight: 258
    radius: Theme.radiusLarge
    color: Theme.panel
    border.width: 1
    border.color: Theme.border

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 22
            Text {
                text: "Compressor"
                color: Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textL
                font.weight: Font.DemiBold
            }
            Text {
                text: "DYNAMICS"
                color: Theme.textDim
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textXS
                font.weight: Font.DemiBold
                font.letterSpacing: 0.65
            }
            Item { Layout.fillWidth: true }
            Rectangle {
                Layout.preferredWidth: 94
                Layout.preferredHeight: 24
                radius: 5
                color: "#0A0E12"
                border.width: 1
                border.color: Theme.borderSoft
                Row {
                    anchors.centerIn: parent
                    spacing: 5
                    Text { text: "GR"; color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.Bold }
                    Text { text: root.gainReduction.toFixed(1) + " dB"; color: Theme.amber; font.family: Theme.fontFamily; font.pixelSize: Theme.textXS; font.weight: Font.Bold }
                }
            }
        }

        Rectangle {
            id: graph
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumHeight: 116
            radius: 7
            color: Theme.recessed
            border.width: 1
            border.color: Theme.borderSoft
            clip: true

            Repeater {
                model: 4
                delegate: Rectangle {
                    required property int index
                    width: index === 0 ? 0 : 1
                    height: parent.height
                    x: index * parent.width / 4
                    color: Theme.borderSoft
                    opacity: 0.7
                }
            }
            Repeater {
                model: 4
                delegate: Rectangle {
                    required property int index
                    height: index === 0 ? 0 : 1
                    width: parent.width
                    y: index * parent.height / 4
                    color: Theme.borderSoft
                    opacity: 0.7
                }
            }

            Canvas {
                id: curve
                anchors.fill: parent
                anchors.margins: 7
                antialiasing: true
                onPaint: {
                    var ctx = getContext("2d")
                    ctx.reset()
                    var w = width
                    var h = height
                    var t = root.clamp((root.threshold + 60) / 60, 0, 1)
                    var tx = t * w
                    var ty = h - t * h
                    var slope = 1 / Math.max(1, root.ratio)
                    var endY = ty - (w - tx) * (h / w) * slope
                    endY = Math.max(5, Math.min(h - 5, endY))

                    ctx.strokeStyle = "#38434D"
                    ctx.lineWidth = 1
                    ctx.setLineDash([5,4])
                    ctx.beginPath(); ctx.moveTo(0,h); ctx.lineTo(w,0); ctx.stroke()
                    ctx.setLineDash([])

                    ctx.beginPath()
                    ctx.moveTo(tx, ty)
                    ctx.lineTo(w, endY)
                    ctx.lineTo(w, h)
                    ctx.lineTo(tx, h)
                    ctx.closePath()
                    var fill = ctx.createLinearGradient(tx, ty, w, h)
                    fill.addColorStop(0, "rgba(240,185,40,0.16)")
                    fill.addColorStop(1, "rgba(240,185,40,0.025)")
                    ctx.fillStyle = fill
                    ctx.fill()

                    ctx.lineCap = "round"
                    ctx.strokeStyle = Theme.amber.toString()
                    ctx.lineWidth = 2
                    ctx.beginPath(); ctx.moveTo(0,h); ctx.lineTo(tx,ty); ctx.lineTo(w,endY); ctx.stroke()

                    ctx.fillStyle = Theme.amber.toString()
                    ctx.beginPath(); ctx.arc(tx,ty,4.5,0,Math.PI*2); ctx.fill()
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 8
            radius: 4
            color: "#090D10"
            border.width: 1
            border.color: Theme.borderSoft
            Rectangle {
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                anchors.margins: 2
                width: Math.min(parent.width - 4, (parent.width - 4) * Math.min(1, Math.abs(root.gainReduction) / 12))
                radius: 2
                color: Theme.amber
                opacity: 0.86
                Behavior on width { SmoothedAnimation { velocity: 260 } }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 76
            spacing: 3
            StudioKnob { Layout.fillWidth: true; compact: true; title: "THRESH"; value: root.threshold; from: -60; to: 0; defaultValue: -18; decimals: 1; unit: "dB"; accentColor: Theme.amber; onValueEdited: function(v) { root.threshold = v; curve.requestPaint() } }
            StudioKnob { Layout.fillWidth: true; compact: true; title: "RATIO"; value: root.ratio; from: 1; to: 10; defaultValue: 3; decimals: 1; unit: ":1"; accentColor: Theme.amber; onValueEdited: function(v) { root.ratio = v; curve.requestPaint() } }
            StudioKnob { Layout.fillWidth: true; compact: true; title: "ATTACK"; value: root.attack; from: 1; to: 100; defaultValue: 12; decimals: 0; unit: "ms"; accentColor: Theme.accent; onValueEdited: function(v) { root.attack = v } }
            StudioKnob { Layout.fillWidth: true; compact: true; title: "RELEASE"; value: root.release; from: 20; to: 800; defaultValue: 140; decimals: 0; unit: "ms"; accentColor: Theme.accent; onValueEdited: function(v) { root.release = v } }
        }
    }

    onThresholdChanged: curve.requestPaint()
    onRatioChanged: curve.requestPaint()
}
