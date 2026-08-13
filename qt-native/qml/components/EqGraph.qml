import QtQuick
import QtQuick.Layouts

StudioPanel {
    id: root
    required property var bandModel

    property int selectedIndex: 0
    property real selectedFreq: 80
    property real selectedGain: 0.0
    property real selectedQ: 1.00
    property real hpfFreq: 20
    property real lpfFreq: 20000

    implicitHeight: 430
    accentTop: true

    readonly property var bands: root.bandModel

    function clamp(v,a,b) { return Math.max(a,Math.min(b,v)) }
    function freqToNorm(f) { return Math.log(f / 20) / Math.log(20000 / 20) }
    function normToFreq(n) { return 20 * Math.pow(1000, clamp(n,0,1)) }
    function gainToNorm(g) { return (24 - g) / 48 }
    function normToGain(n) { return 24 - clamp(n,0,1) * 48 }
    function responseAt(freq) {
        var sum = 0
        for (var i=0;i<bands.count;++i) {
            var b = bands.get(i)
            var oct = Math.log(freq / b.freq) / Math.LN2
            var width = Math.max(0.20, 1.05 / b.q)
            sum += b.gain * Math.exp(-0.5 * Math.pow(oct / width,2))
        }
        return clamp(sum,-24,24)
    }
    function selectBand(i) {
        selectedIndex = i
        var b = bands.get(i)
        selectedFreq = b.freq
        selectedGain = b.gain
        selectedQ = b.q
    }
    function updateSelected() {
        bands.setBand(selectedIndex, selectedFreq, selectedGain, selectedQ)
        curve.requestPaint()
    }
    function setSelectedFrequency(v) { selectedFreq = clamp(v, 20, 20000); updateSelected() }
    function setSelectedGain(v) { selectedGain = clamp(v, -24, 24); updateSelected() }
    function setSelectedQValue(v) { selectedQ = clamp(v, 0.1, 30); updateSelected() }
    function resetSelected() { selectedGain = 0; selectedQ = 1; updateSelected() }
    function resetAll() {
        bands.resetAll()
        selectBand(0)
        curve.requestPaint()
    }
    function adjustSelectedQ(direction, fine) {
        var increment = fine ? 0.02 : 0.1
        selectedQ = Math.round(clamp(selectedQ + direction * increment, 0.1, 30) * 100) / 100
        updateSelected()
    }
    function freqLabel(f) { return f >= 1000 ? (f/1000).toFixed(f>=10000?1:2)+"k" : Math.round(f).toString() }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 26
            spacing: 7
            Text {
                text: "Music Parametric EQ"
                color: Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textL
                font.weight: Font.DemiBold
            }
            Rectangle { width: 5; height: 5; radius: 3; color: Theme.accent }
            Text {
                text: "7 BANDS"
                color: Theme.textDim
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textXS
                font.weight: Font.DemiBold
                font.letterSpacing: 0.65
            }
            Item { Layout.fillWidth: true }
            SoftButton { text: "FLAT"; compact: true; onClicked: root.resetAll() }
            SoftButton { text: "A/B"; compact: true }
        }

        Rectangle {
            id: graph
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumHeight: 270
            radius: 7
            color: Theme.recessed
            border.width: 1
            border.color: Theme.borderSoft
            clip: true
            activeFocusOnTab: true

            Keys.onPressed: function(event) {
                var fine = (event.modifiers & Qt.ShiftModifier) !== 0
                if ((event.modifiers & Qt.ControlModifier) !== 0 && (event.key === Qt.Key_Up || event.key === Qt.Key_Down)) {
                    root.adjustSelectedQ(event.key === Qt.Key_Up ? 1 : -1, fine)
                    event.accepted = true
                } else if (event.key === Qt.Key_Up || event.key === Qt.Key_Down) {
                    root.setSelectedGain(root.selectedGain + (event.key === Qt.Key_Up ? 1 : -1) * (fine ? 0.1 : 0.5))
                    event.accepted = true
                } else if (event.key === Qt.Key_Left || event.key === Qt.Key_Right) {
                    var factor = fine ? 1.01 : 1.06
                    root.setSelectedFrequency(root.selectedFreq * (event.key === Qt.Key_Right ? factor : 1 / factor))
                    event.accepted = true
                }
            }

            Rectangle {
                anchors.fill: parent
                gradient: Gradient {
                    GradientStop { position: 0.0; color: "#0A0E12" }
                    GradientStop { position: 0.48; color: "#070A0D" }
                    GradientStop { position: 1.0; color: "#050709" }
                }
            }

            Repeater {
                model: [20,30,50,70,100,200,500,1000,2000,5000,10000,20000]
                delegate: Rectangle {
                    required property var modelData
                    x: root.freqToNorm(modelData) * graph.width
                    width: 1
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    color: modelData === 1000 ? "#34414B" : "#1B242B"
                    opacity: modelData === 1000 ? 0.85 : 0.62
                    Text {
                        anchors.top: parent.top
                        anchors.topMargin: 7
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: modelData>=1000 ? (modelData/1000)+"k" : modelData
                        color: Theme.textFaint
                        font.family: Theme.fontFamily
                        font.pixelSize: 8
                    }
                }
            }

            Repeater {
                model: [-24,-18,-12,-6,0,6,12,18,24]
                delegate: Rectangle {
                    required property var modelData
                    y: root.gainToNorm(modelData) * graph.height
                    height: modelData===0 ? 1.5 : 1
                    anchors.left: parent.left
                    anchors.right: parent.right
                    color: modelData===0 ? "#667681" : "#1A2229"
                    opacity: modelData===0 ? 0.7 : 0.58
                    Text {
                        anchors.left: parent.left
                        anchors.leftMargin: 7
                        anchors.bottom: parent.top
                        anchors.bottomMargin: 2
                        text: modelData>0 ? "+"+modelData : modelData
                        color: Theme.textFaint
                        font.family: Theme.fontFamily
                        font.pixelSize: 8
                    }
                }
            }

            Rectangle {
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: 1
                color: Theme.amber
                opacity: 0.35
            }
            Rectangle {
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: 1
                color: Theme.amber
                opacity: 0.35
            }
            Text { anchors.left: parent.left; anchors.leftMargin: 8; anchors.top: parent.top; anchors.topMargin: 30; text: "HP 20 Hz"; color: Theme.amber; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.DemiBold }
            Text { anchors.right: parent.right; anchors.rightMargin: 8; anchors.top: parent.top; anchors.topMargin: 30; text: "LP 20 kHz"; color: Theme.amber; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.DemiBold }

            Canvas {
                id: curve
                anchors.fill: parent
                antialiasing: true
                onPaint: {
                    var ctx = getContext("2d")
                    ctx.reset()
                    var samples = Math.max(260,Math.floor(width/2.5))
                    var zero = root.gainToNorm(0)*height
                    ctx.beginPath()
                    for (var i=0;i<=samples;++i) {
                        var nx=i/samples
                        var y=root.gainToNorm(root.responseAt(root.normToFreq(nx)))*height
                        if(i===0)ctx.moveTo(nx*width,y); else ctx.lineTo(nx*width,y)
                    }
                    ctx.lineTo(width,zero); ctx.lineTo(0,zero); ctx.closePath()
                    var fill=ctx.createLinearGradient(0,0,0,height)
                    fill.addColorStop(0,"rgba(94,221,212,0.16)")
                    fill.addColorStop(0.5,"rgba(94,221,212,0.025)")
                    fill.addColorStop(1,"rgba(240,185,40,0.04)")
                    ctx.fillStyle=fill; ctx.fill()

                    ctx.beginPath()
                    for(var j=0;j<=samples;++j){
                        var n=j/samples
                        var yy=root.gainToNorm(root.responseAt(root.normToFreq(n)))*height
                        if(j===0)ctx.moveTo(n*width,yy); else ctx.lineTo(n*width,yy)
                    }
                    ctx.lineWidth=5; ctx.strokeStyle="rgba(94,221,212,0.08)"; ctx.stroke()
                    ctx.lineWidth=2.2; ctx.strokeStyle=Theme.accent.toString(); ctx.stroke()
                }
            }

            WheelHandler {
                target: null
                onWheel: function(event) {
                    graph.forceActiveFocus()
                    root.adjustSelectedQ(event.angleDelta.y > 0 ? 1 : -1, (event.modifiers & Qt.ShiftModifier) !== 0)
                    event.accepted = true
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
                    required property string typeName
                    width: index===root.selectedIndex ? 27 : 22
                    height: width
                    x: root.freqToNorm(freq)*graph.width-width/2
                    y: root.gainToNorm(gain)*graph.height-height/2

                    Rectangle {
                        anchors.centerIn: parent
                        width: parent.width + (index===root.selectedIndex ? 12 : 8)
                        height: width
                        radius: width/2
                        color: index===root.selectedIndex ? Theme.accentFaint : Theme.amberFaint
                        border.width: 0
                    }
                    Rectangle {
                        anchors.fill: parent
                        radius: width/2
                        color: index===root.selectedIndex ? Theme.accent : "#16130A"
                        border.width: index===root.selectedIndex ? 2 : 1
                        border.color: index===root.selectedIndex ? "#B8FFF9" : Theme.amber
                        Text {
                            anchors.centerIn: parent
                            text: index+1
                            color: index===root.selectedIndex ? "#07100F" : Theme.amber
                            font.family: Theme.fontFamily
                            font.pixelSize: 9
                            font.weight: Font.Bold
                        }
                    }
                    MouseArea {
                        property real lastX: 0
                        property real lastY: 0
                        anchors.fill: parent
                        anchors.margins: -9
                        cursorShape: Qt.SizeAllCursor
                        onPressed: function(e) {
                            root.selectBand(index)
                            graph.forceActiveFocus()
                            lastX = e.x
                            lastY = e.y
                        }
                        onPositionChanged: function(e) {
                            if(!pressed)return
                            var fine = (e.modifiers & Qt.ShiftModifier) !== 0
                            if ((e.modifiers & Qt.ControlModifier) !== 0) {
                                var dy = e.y - lastY
                                lastY = e.y
                                var nextQ = root.clamp(q * Math.exp(-dy * (fine ? 0.003 : 0.012)), 0.1, 30)
                                bands.setBand(index, freq, gain, nextQ)
                                if (index === root.selectedIndex) root.selectedQ = nextQ
                                curve.requestPaint()
                                return
                            }
                            var p=mapToItem(graph,e.x,e.y)
                            if (fine) {
                                var currentX = root.freqToNorm(freq) * graph.width
                                var currentY = root.gainToNorm(gain) * graph.height
                                p.x = currentX + (e.x - lastX) * 0.25
                                p.y = currentY + (e.y - lastY) * 0.25
                                lastX = e.x
                                lastY = e.y
                            }
                            var f=root.normToFreq(p.x/graph.width)
                            var g=root.normToGain(p.y/graph.height)
                            if (!fine && Math.abs(g) < 0.3) g = 0
                            bands.setBand(index, f, g, q)
                            if(index===root.selectedIndex){root.selectedFreq=f;root.selectedGain=g}
                            curve.requestPaint()
                        }
                    }
                }
            }

            Rectangle {
                id: floatingEditor
                width: 286
                height: 68
                x: root.clamp(root.freqToNorm(root.selectedFreq)*graph.width-width/2, 14, graph.width-width-14)
                y: graph.height - height - 18
                radius: 7
                color: "#E912171D"
                border.width: 1
                border.color: "#40505C"
                Behavior on x { SmoothedAnimation { velocity: 1500 } }

                Rectangle {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.top: parent.top
                    anchors.leftMargin: 8
                    anchors.rightMargin: 8
                    height: 1
                    color: Theme.accent
                    opacity: 0.34
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 9
                    spacing: 8
                    ColumnLayout {
                        Layout.preferredWidth: 84
                        spacing: 1
                        Text { text: "BAND "+(root.selectedIndex+1); color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.DemiBold }
                        Text { text: bands.get(root.selectedIndex).typeName; color: Theme.text; font.family: Theme.fontFamily; font.pixelSize: Theme.textS; font.weight: Font.DemiBold }
                    }
                    Rectangle { width: 1; Layout.fillHeight: true; color: Theme.borderSoft }
                    ColumnLayout { Layout.fillWidth: true; spacing: 1; Text { text:"FREQ"; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8 } Text { text:root.freqLabel(root.selectedFreq)+" Hz"; color:Theme.amber; font.family:Theme.fontFamily; font.pixelSize:Theme.textS; font.weight:Font.Bold } }
                    ColumnLayout { Layout.fillWidth: true; spacing: 1; Text { text:"GAIN"; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8 } Text { text:(root.selectedGain>0?"+":"")+root.selectedGain.toFixed(1)+" dB"; color:Theme.accent; font.family:Theme.fontFamily; font.pixelSize:Theme.textS; font.weight:Font.Bold } }
                    ColumnLayout { Layout.fillWidth: true; spacing: 1; Text { text:"Q"; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8 } Text { text:root.selectedQ.toFixed(2); color:Theme.text; font.family:Theme.fontFamily; font.pixelSize:Theme.textS; font.weight:Font.Bold } }
                }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 58
            spacing: 8

            RowLayout {
                Layout.fillWidth: true
                spacing: 5
                Repeater {
                    model: bands
                    delegate: Rectangle {
                        required property int index
                        required property real freq
                        required property real gain
                        required property real q
                        required property string typeName
                        Layout.fillWidth: true
                        Layout.preferredHeight: 50
                        radius: 6
                        color: index===root.selectedIndex ? Theme.accentFaint : "#0B1014"
                        border.width: 1
                        border.color: index===root.selectedIndex ? Theme.accent : Theme.borderSoft
                        Column {
                            anchors.fill: parent
                            anchors.margins: 6
                            spacing: 1
                            Row {
                                width: parent.width
                                Text { text:"B"+(index+1); color:index===root.selectedIndex?Theme.accent:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8; font.weight:Font.Bold }
                            }
                            Text { text:root.freqLabel(freq); color:Theme.amber; font.family:Theme.fontFamily; font.pixelSize:Theme.textXS; font.weight:Font.Bold }
                            Text { text:(gain>0?"+":"")+gain.toFixed(1)+" dB"; color:Theme.textSoft; font.family:Theme.fontFamily; font.pixelSize:8 }
                        }
                        MouseArea { anchors.fill: parent; cursorShape:Qt.PointingHandCursor; onClicked:root.selectBand(index) }
                    }
                }
            }

        }
    }
}
