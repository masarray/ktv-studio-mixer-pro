import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root

    property int selectedIndex: 3
    property real selectedFreq: 2400
    property real selectedGain: 1.6
    property real selectedQ: 0.82

    implicitHeight: 430
    radius: Theme.radiusLarge
    color: Theme.panel
    border.width: 1
    border.color: Theme.border

    ListModel {
        id: bands
        ListElement { freq: 70; gain: 0.0; q: 0.75; tint: "#69D8CF" }
        ListElement { freq: 160; gain: 2.2; q: 1.10; tint: "#77BDEA" }
        ListElement { freq: 720; gain: -1.4; q: 1.35; tint: "#839FF2" }
        ListElement { freq: 2400; gain: 1.6; q: 0.82; tint: "#A793F3" }
        ListElement { freq: 8200; gain: 2.8; q: 0.68; tint: "#D0A8E9" }
        ListElement { freq: 15000; gain: -0.5; q: 0.72; tint: "#E3C778" }
    }

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
    function freqToNorm(freq) { return Math.log(freq / 20) / Math.log(20000 / 20) }
    function normToFreq(n) { return 20 * Math.pow(20000 / 20, clamp(n, 0, 1)) }
    function gainToNorm(g) { return (12 - g) / 24 }
    function normToGain(n) { return 12 - clamp(n, 0, 1) * 24 }

    function responseAt(freq) {
        var sum = 0.0
        for (var i = 0; i < bands.count; ++i) {
            var b = bands.get(i)
            var oct = Math.log(freq / b.freq) / Math.LN2
            var width = Math.max(0.18, 1.15 / b.q)
            sum += b.gain * Math.exp(-0.5 * Math.pow(oct / width, 2))
        }
        return clamp(sum, -12, 12)
    }

    function selectBand(index) {
        selectedIndex = index
        var b = bands.get(index)
        selectedFreq = b.freq
        selectedGain = b.gain
        selectedQ = b.q
    }

    function updateSelected() {
        bands.setProperty(selectedIndex, "freq", selectedFreq)
        bands.setProperty(selectedIndex, "gain", selectedGain)
        bands.setProperty(selectedIndex, "q", selectedQ)
        curve.requestPaint()
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 14
        spacing: 10

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 25
            spacing: 8

            Text {
                text: "PARAMETRIC EQ"
                color: Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textM
                font.weight: Font.DemiBold
                font.letterSpacing: 0.6
            }

            Rectangle {
                width: 5; height: 5; radius: 3
                color: Theme.green
            }

            Text {
                text: "6 BAND"
                color: Theme.textDim
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textXS
                font.weight: Font.Medium
            }

            Item { Layout.fillWidth: true }

            SoftButton { text: "FLAT"; compact: true }
            SoftButton { text: "A/B"; compact: true }
        }

        Rectangle {
            id: graph
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumHeight: 250
            radius: Theme.radius
            color: "#0B0E12"
            border.width: 1
            border.color: Theme.borderSoft
            clip: true

            Repeater {
                model: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
                delegate: Rectangle {
                    required property var modelData
                    x: root.freqToNorm(modelData) * graph.width
                    width: 1
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    color: modelData === 1000 ? "#27313A" : "#1C232A"
                    opacity: modelData === 1000 ? 0.9 : 0.72

                    Text {
                        anchors.top: parent.top
                        anchors.topMargin: 7
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: modelData >= 1000 ? (modelData / 1000) + "k" : modelData
                        color: Theme.textDim
                        font.family: Theme.fontFamily
                        font.pixelSize: 9
                    }
                }
            }

            Repeater {
                model: [-12, -6, 0, 6, 12]
                delegate: Rectangle {
                    required property var modelData
                    y: root.gainToNorm(modelData) * graph.height
                    height: modelData === 0 ? 1.5 : 1
                    anchors.left: parent.left
                    anchors.right: parent.right
                    color: modelData === 0 ? "#52616E" : "#1E262D"
                    opacity: modelData === 0 ? 0.72 : 0.66

                    Text {
                        anchors.left: parent.left
                        anchors.leftMargin: 7
                        anchors.bottom: parent.top
                        anchors.bottomMargin: 2
                        text: modelData > 0 ? "+" + modelData : modelData
                        color: Theme.textDim
                        font.family: Theme.fontFamily
                        font.pixelSize: 9
                    }
                }
            }

            Canvas {
                id: curve
                anchors.fill: parent
                antialiasing: true

                onPaint: {
                    var ctx = getContext("2d")
                    ctx.reset()
                    var samples = Math.max(220, Math.floor(width / 3))
                    var baseY = root.gainToNorm(0) * height

                    ctx.beginPath()
                    for (var i = 0; i <= samples; ++i) {
                        var nx = i / samples
                        var f = root.normToFreq(nx)
                        var y = root.gainToNorm(root.responseAt(f)) * height
                        if (i === 0) ctx.moveTo(nx * width, y)
                        else ctx.lineTo(nx * width, y)
                    }
                    ctx.lineTo(width, baseY)
                    ctx.lineTo(0, baseY)
                    ctx.closePath()
                    var fill = ctx.createLinearGradient(0, 0, 0, height)
                    fill.addColorStop(0, "rgba(101,221,212,0.12)")
                    fill.addColorStop(0.5, "rgba(101,221,212,0.035)")
                    fill.addColorStop(1, "rgba(101,221,212,0.10)")
                    ctx.fillStyle = fill
                    ctx.fill()

                    ctx.beginPath()
                    for (var j = 0; j <= samples; ++j) {
                        var n2 = j / samples
                        var f2 = root.normToFreq(n2)
                        var y2 = root.gainToNorm(root.responseAt(f2)) * height
                        if (j === 0) ctx.moveTo(n2 * width, y2)
                        else ctx.lineTo(n2 * width, y2)
                    }
                    ctx.lineWidth = 2.1
                    ctx.lineJoin = "round"
                    ctx.strokeStyle = Theme.accent.toString()
                    ctx.stroke()
                }
            }

            Repeater {
                model: bands
                delegate: Item {
                    id: node
                    required property int index
                    required property real freq
                    required property real gain
                    required property real q
                    required property string tint

                    width: index === root.selectedIndex ? 25 : 20
                    height: width
                    x: root.freqToNorm(freq) * graph.width - width / 2
                    y: root.gainToNorm(gain) * graph.height - height / 2

                    Rectangle {
                        anchors.fill: parent
                        radius: width / 2
                        color: index === root.selectedIndex ? tint : "#10151A"
                        border.width: index === root.selectedIndex ? 2 : 1
                        border.color: tint

                        Text {
                            anchors.centerIn: parent
                            text: index + 1
                            color: index === root.selectedIndex ? "#0A0D10" : tint
                            font.family: Theme.fontFamily
                            font.pixelSize: 9
                            font.weight: Font.Bold
                        }
                    }

                    MouseArea {
                        anchors.fill: parent
                        anchors.margins: -8
                        cursorShape: Qt.SizeAllCursor

                        onPressed: root.selectBand(index)
                        onPositionChanged: function(event) {
                            if (!pressed) return
                            var p = mapToItem(graph, event.x, event.y)
                            var f = root.normToFreq(p.x / graph.width)
                            var g = root.normToGain(p.y / graph.height)
                            bands.setProperty(index, "freq", f)
                            bands.setProperty(index, "gain", g)
                            if (index === root.selectedIndex) {
                                root.selectedFreq = f
                                root.selectedGain = g
                            }
                            curve.requestPaint()
                        }
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 82
            radius: Theme.radius
            color: Theme.bgRaised
            border.width: 1
            border.color: Theme.borderSoft

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 12
                anchors.rightMargin: 12
                spacing: 8

                Rectangle {
                    Layout.preferredWidth: 58
                    Layout.preferredHeight: 50
                    radius: Theme.radiusSmall
                    color: "#0B0F12"
                    border.width: 1
                    border.color: Theme.borderSoft

                    Column {
                        anchors.centerIn: parent
                        spacing: 2
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "BAND"
                            color: Theme.textDim
                            font.family: Theme.fontFamily
                            font.pixelSize: 9
                            font.weight: Font.DemiBold
                        }
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "0" + (root.selectedIndex + 1)
                            color: Theme.text
                            font.family: Theme.fontFamily
                            font.pixelSize: 17
                            font.weight: Font.DemiBold
                        }
                    }
                }

                SoftButton {
                    Layout.preferredWidth: 62
                    text: "BELL"
                    checked: true
                }

                Item { Layout.fillWidth: true }

                StudioKnob {
                    compact: true
                    title: "FREQ"
                    value: root.selectedFreq
                    from: 20
                    to: 20000
                    defaultValue: 1000
                    logarithmic: true
                    decimals: 0
                    unit: "Hz"
                    accentColor: bands.get(root.selectedIndex).tint
                    onValueEdited: function(v) { root.selectedFreq = v; root.updateSelected() }
                }

                StudioKnob {
                    compact: true
                    title: "GAIN"
                    value: root.selectedGain
                    from: -12
                    to: 12
                    defaultValue: 0
                    decimals: 1
                    unit: "dB"
                    accentColor: bands.get(root.selectedIndex).tint
                    onValueEdited: function(v) { root.selectedGain = v; root.updateSelected() }
                }

                StudioKnob {
                    compact: true
                    title: "Q"
                    value: root.selectedQ
                    from: 0.2
                    to: 8
                    defaultValue: 0.71
                    logarithmic: true
                    decimals: 2
                    unit: ""
                    accentColor: bands.get(root.selectedIndex).tint
                    onValueEdited: function(v) { root.selectedQ = v; root.updateSelected() }
                }

                Item { Layout.fillWidth: true }

                SoftButton { text: "BYPASS" }
            }
        }
    }

    Component.onCompleted: selectBand(selectedIndex)
}
