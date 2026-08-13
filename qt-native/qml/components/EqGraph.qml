import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root

    property int selectedIndex: 0
    property real selectedFreq: 72
    property real selectedGain: 2.6
    property real selectedQ: 0.70

    implicitHeight: 430
    radius: Theme.radiusLarge
    color: Theme.panel
    border.width: 1
    border.color: Theme.border

    ListModel {
        id: bands
        ListElement { freq: 72; gain: 2.6; q: 0.70; typeName: "LOW SHELF" }
        ListElement { freq: 125; gain: 1.1; q: 0.90; typeName: "BELL" }
        ListElement { freq: 310; gain: -1.3; q: 1.25; typeName: "BELL" }
        ListElement { freq: 720; gain: -0.4; q: 1.05; typeName: "BELL" }
        ListElement { freq: 2200; gain: -1.1; q: 1.00; typeName: "BELL" }
        ListElement { freq: 6200; gain: 0.7; q: 0.78; typeName: "BELL" }
        ListElement { freq: 12500; gain: 1.8; q: 0.72; typeName: "HIGH SHELF" }
    }

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
        bands.setProperty(selectedIndex,"freq",selectedFreq)
        bands.setProperty(selectedIndex,"gain",selectedGain)
        bands.setProperty(selectedIndex,"q",selectedQ)
        curve.requestPaint()
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
            SoftButton { text: "FLAT"; compact: true }
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
                        anchors.fill: parent
                        anchors.margins: -9
                        cursorShape: Qt.SizeAllCursor
                        onPressed: root.selectBand(index)
                        onPositionChanged: function(e) {
                            if(!pressed)return
                            var p=mapToItem(graph,e.x,e.y)
                            var f=root.normToFreq(p.x/graph.width)
                            var g=root.normToGain(p.y/graph.height)
                            bands.setProperty(index,"freq",f)
                            bands.setProperty(index,"gain",g)
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
                y: root.clamp(root.gainToNorm(root.selectedGain)*graph.height+30, 62, graph.height-height-18)
                radius: 7
                color: "#E912171D"
                border.width: 1
                border.color: "#40505C"

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
            Layout.preferredHeight: 74
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

            Rectangle { Layout.preferredWidth: 1; Layout.fillHeight: true; color:Theme.borderSoft }

            StudioKnob { Layout.preferredWidth: 70; compact:true; title:"FREQ"; value:root.selectedFreq; from:20; to:20000; defaultValue:1000; logarithmic:true; decimals:0; unit:"Hz"; accentColor:Theme.amber; onValueEdited:function(v){root.selectedFreq=v;root.updateSelected()} }
            StudioKnob { Layout.preferredWidth: 70; compact:true; title:"GAIN"; value:root.selectedGain; from:-24; to:24; defaultValue:0; decimals:1; unit:"dB"; accentColor:Theme.accent; onValueEdited:function(v){root.selectedGain=v;root.updateSelected()} }
            StudioKnob { Layout.preferredWidth: 70; compact:true; title:"Q"; value:root.selectedQ; from:0.2; to:10; defaultValue:1; decimals:2; unit:""; accentColor:Theme.violet; onValueEdited:function(v){root.selectedQ=v;root.updateSelected()} }
        }
    }
}
