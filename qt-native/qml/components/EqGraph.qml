import QtQuick
import QtQuick.Layouts

StudioPanel {
    id: root
    required property var bandModel
    property int selectedIndex: 0
    property real selectedFreq: 80
    property real selectedGain: 0
    property real selectedQ: 1
    property real hpfFreq: 20
    property real lpfFreq: 20000
    readonly property var bands: bandModel
    readonly property real leftPad: 42
    readonly property real rightPad: 16
    readonly property real topPad: 20
    readonly property real dockHeight: 96
    readonly property real plotBottom: Math.max(topPad + 150, graph.height - dockHeight)
    readonly property var colors: ["#F0B928", "#69AEEA", "#A58AE8", "#57D49A", "#F07A85", "#5EDDD4", "#D8C15B"]
    implicitHeight: 430
    accentTop: true

    function clamp(v,a,b){ return Math.max(a,Math.min(b,v)) }
    function safeQ(q){ return clamp(Number(q)||0.7,0.1,30) }
    function normF(f){ return Math.log(clamp(f,20,20000)/20)/Math.log(1000) }
    function freq(n){ return 20*Math.pow(1000,clamp(n,0,1)) }
    function xFor(f){ return leftPad+normF(f)*Math.max(1,graph.width-leftPad-rightPad) }
    function freqForX(x){ return freq((x-leftPad)/Math.max(1,graph.width-leftPad-rightPad)) }
    function yFor(g){ return topPad+(24-clamp(g,-24,24))/48*Math.max(1,plotBottom-topPad) }
    function gainForY(y){ return 24-clamp((y-topPad)/Math.max(1,plotBottom-topPad),0,1)*48 }
    function colorFor(i){ return colors[i%colors.length] }
    function dbLin(db){ return Math.pow(10,db/20) }

    function peak(f,q,g){
        var sr=48000,A=dbLin(g/2),w=2*Math.PI*clamp(f,1,sr/2-1)/sr
        var a=Math.sin(w)/(2*safeQ(q)),c=Math.cos(w),a0=1+a/A
        return {b0:(1+a*A)/a0,b1:-2*c/a0,b2:(1-a*A)/a0,a1:-2*c/a0,a2:(1-a/A)/a0}
    }
    function shelf(f,q,g,hi){
        var sr=48000,A=dbLin(g/2),w=2*Math.PI*clamp(f,1,sr/2-1)/sr,c=Math.cos(w),s=Math.sin(w)
        var sl=clamp(safeQ(q),0.1,10),rad=Math.max(0.000001,(A+1/A)*(1/sl-1)+2)
        var a=s/2*Math.sqrt(rad),b=2*Math.sqrt(A)*a,a0
        if(!hi){
            a0=(A+1)+(A-1)*c+b
            return {b0:A*((A+1)-(A-1)*c+b)/a0,b1:2*A*((A-1)-(A+1)*c)/a0,b2:A*((A+1)-(A-1)*c-b)/a0,a1:-2*((A-1)+(A+1)*c)/a0,a2:((A+1)+(A-1)*c-b)/a0}
        }
        a0=(A+1)-(A-1)*c+b
        return {b0:A*((A+1)+(A-1)*c+b)/a0,b1:-2*A*((A-1)+(A+1)*c)/a0,b2:A*((A+1)+(A-1)*c-b)/a0,a1:2*((A-1)-(A+1)*c)/a0,a2:((A+1)-(A-1)*c-b)/a0}
    }
    function mag(c,f){
        var w=2*Math.PI*clamp(f,1,23999)/48000,c1=Math.cos(w),s1=Math.sin(w),c2=Math.cos(2*w),s2=Math.sin(2*w)
        var br=c.b0+c.b1*c1+c.b2*c2,bi=-(c.b1*s1+c.b2*s2),ar=1+c.a1*c1+c.a2*c2,ai=-(c.a1*s1+c.a2*s2)
        return 10*Math.log(Math.max((br*br+bi*bi)/Math.max(1e-12,ar*ar+ai*ai),1e-12))/Math.LN10
    }
    function bandDb(b,f){
        if(!b||Math.abs(b.gain)<0.001)return 0
        var t=String(b.typeName||"BELL").toUpperCase(),c
        if(t.indexOf("LOW")>=0||t==="LS")c=shelf(b.freq,b.q,b.gain,false)
        else if(t.indexOf("HIGH")>=0||t==="HS")c=shelf(b.freq,b.q,b.gain,true)
        else c=peak(b.freq,b.q,b.gain)
        return mag(c,f)
    }
    function bessel(order,r){
        var co=order===4?[105,105,45,10,1]:order===3?[15,15,6,1]:[3,3,1]
        var sc=order===4?2.113917674904216:order===3?1.7556723686812106:1.3616541287161308
        var xx=Math.max(0,r)*sc,re=0,im=0
        for(var p=0;p<co.length;++p){var m=co[p]*Math.pow(xx,p),ph=p*Math.PI/2;re+=m*Math.cos(ph);im+=m*Math.sin(ph)}
        return co[0]/Math.max(1e-12,Math.sqrt(re*re+im*im))
    }
    function crossOne(kind,label,cut,f){
        label=String(label||"Butter 12").toUpperCase()
        var order=label.indexOf("24")>=0?4:label.indexOf("18")>=0?3:2
        var r=kind==="lpf"?Math.max(f,1)/Math.max(cut,1):Math.max(cut,1)/Math.max(f,1),m
        if(label.indexOf("BESSEL")>=0)m=bessel(order,r)
        else if(label.indexOf("LR")>=0){var b=1/Math.sqrt(1+Math.pow(r,4));m=b*b}
        else m=1/Math.sqrt(1+Math.pow(r,2*order))
        return 20*Math.log(Math.max(m,1e-12))/Math.LN10
    }
    function crossDb(f){
        var d=0,h=Number(bands.hpfHz)||20,l=Number(bands.lpfHz)||20000
        if(h>20.001)d+=crossOne("hpf",bands.hpType,h,f)
        if(l<19999.999)d+=crossOne("lpf",bands.lpType,l,f)
        return d
    }
    function totalDb(f){ var d=crossDb(f); for(var i=0;i<bands.count;++i)d+=bandDb(bands.get(i),f); return clamp(d,-48,48) }
    function fmtF(f){ return f>=1000?(f/1000).toFixed(f>=10000?1:2)+"k":Math.round(f).toString() }

    function selectBand(i){
        if(bands.count<1)return
        selectedIndex=clamp(i,0,bands.count-1)
        var b=bands.get(selectedIndex);selectedFreq=b.freq;selectedGain=b.gain;selectedQ=b.q
    }
    function updateSelected(){ bands.setBand(selectedIndex,selectedFreq,selectedGain,selectedQ);curve.requestPaint() }
    function setSelectedFrequency(v){selectedFreq=clamp(v,20,20000);updateSelected()}
    function setSelectedGain(v){selectedGain=clamp(v,-24,24);updateSelected()}
    function setSelectedQValue(v){selectedQ=clamp(v,0.1,30);updateSelected()}
    function resetSelected(){bands.resetBand(selectedIndex);selectBand(selectedIndex);curve.requestPaint()}
    function resetAll(){bands.resetAll();selectBand(0);curve.requestPaint()}
    function adjustQ(dir,fine){selectedQ=Math.round(clamp(selectedQ+dir*(fine?0.02:0.1),0.1,30)*100)/100;updateSelected()}

    Connections {
        target: bands
        function onBandChanged(){root.selectBand(root.selectedIndex);curve.requestPaint()}
        function onCrossoverChanged(){curve.requestPaint()}
    }
    Component.onCompleted: { selectBand(0); curve.requestPaint() }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 26
            spacing: 7
            Text { text:"Music Parametric EQ"; color:Theme.text; font.family:Theme.fontFamily; font.pixelSize:Theme.textL; font.weight:Font.DemiBold }
            Rectangle { width:5;height:5;radius:3;color:Theme.accent }
            Text { text:"7 BANDS";color:Theme.textDim;font.family:Theme.fontFamily;font.pixelSize:Theme.textXS;font.weight:Font.DemiBold;font.letterSpacing:0.65 }
            Item { Layout.fillWidth:true }
            SoftButton { text:"FLAT";compact:true;onClicked:root.resetAll() }
            SoftButton { text:"A/B";compact:true }
        }

        Rectangle {
            id: graph
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumHeight: 300
            radius: 7
            color: Theme.recessed
            border.width: 1
            border.color: Theme.borderSoft
            clip: true
            activeFocusOnTab: true

            Rectangle { anchors.fill:parent; gradient:Gradient { GradientStop{position:0;color:"#0A0E12"} GradientStop{position:0.55;color:"#070A0D"} GradientStop{position:1;color:"#050709"} } }

            Repeater {
                model:[20,30,50,70,100,200,500,1000,2000,5000,10000,20000]
                delegate: Rectangle {
                    required property var modelData
                    x:root.xFor(modelData);y:root.topPad;width:1;height:graph.height-root.topPad-8
                    color:modelData===1000?"#34414B":"#1B242B";opacity:modelData===1000?0.70:0.46
                    Text { y:root.plotBottom-root.topPad+6;anchors.horizontalCenter:parent.horizontalCenter;text:modelData>=1000?(modelData/1000)+"k":modelData;color:Theme.textFaint;font.family:Theme.fontFamily;font.pixelSize:8 }
                }
            }
            Repeater {
                model:[-24,-18,-12,-6,0,6,12,18,24]
                delegate: Rectangle {
                    required property var modelData
                    x:root.leftPad;y:root.yFor(modelData);width:graph.width-root.leftPad-root.rightPad;height:modelData===0?1.5:1
                    color:modelData===0?"#60727D":"#1A2229";opacity:modelData===0?0.72:0.50
                    Text { anchors.right:parent.left;anchors.rightMargin:7;anchors.verticalCenter:parent.verticalCenter;text:modelData>0?"+"+modelData:modelData;color:Theme.textFaint;font.family:Theme.fontFamily;font.pixelSize:8 }
                }
            }

            Canvas {
                id: curve
                anchors.fill: parent
                antialiasing: true
                onWidthChanged: requestPaint()
                onHeightChanged: requestPaint()
                onPaint: {
                    var c=getContext("2d");c.reset();var n=Math.max(280,Math.floor(width/3)),zero=root.yFor(0),i,t,f,x,y
                    c.beginPath()
                    for(i=0;i<=n;++i){t=i/n;f=root.freq(t);x=root.leftPad+t*(width-root.leftPad-root.rightPad);y=root.yFor(root.totalDb(f));if(i===0)c.moveTo(x,y);else c.lineTo(x,y)}
                    c.lineTo(width-root.rightPad,zero);c.lineTo(root.leftPad,zero);c.closePath()
                    var fill=c.createLinearGradient(0,root.topPad,0,root.plotBottom);fill.addColorStop(0,"rgba(94,221,212,0.09)");fill.addColorStop(0.52,"rgba(94,221,212,0.018)");fill.addColorStop(1,"rgba(240,185,40,0.012)");c.fillStyle=fill;c.fill()
                    for(var b=0;b<root.bands.count;++b){var band=root.bands.get(b);if(Math.abs(band.gain)<0.05)continue;c.beginPath();for(i=0;i<=n;++i){t=i/n;f=root.freq(t);x=root.leftPad+t*(width-root.leftPad-root.rightPad);y=root.yFor(root.bandDb(band,f));if(i===0)c.moveTo(x,y);else c.lineTo(x,y)}c.globalAlpha=b===root.selectedIndex?0.72:0.18;c.lineWidth=b===root.selectedIndex?1.55:0.9;c.strokeStyle=root.colorFor(b);c.stroke()}
                    c.beginPath();for(i=0;i<=n;++i){t=i/n;f=root.freq(t);x=root.leftPad+t*(width-root.leftPad-root.rightPad);y=root.yFor(root.crossDb(f));if(i===0)c.moveTo(x,y);else c.lineTo(x,y)}c.globalAlpha=0.30;c.lineWidth=0.95;c.strokeStyle="#AA9460";c.stroke()
                    c.beginPath();for(i=0;i<=n;++i){t=i/n;f=root.freq(t);x=root.leftPad+t*(width-root.leftPad-root.rightPad);y=root.yFor(root.totalDb(f));if(i===0)c.moveTo(x,y);else c.lineTo(x,y)}c.globalAlpha=0.82;c.lineWidth=4.4;c.strokeStyle="#020405";c.stroke();c.globalAlpha=0.055;c.lineWidth=6.3;c.strokeStyle=Theme.accent.toString();c.stroke();c.globalAlpha=0.94;c.lineWidth=1.8;var st=c.createLinearGradient(root.leftPad,0,width-root.rightPad,0);st.addColorStop(0,Theme.accent.toString());st.addColorStop(0.62,"#8EDAD4");st.addColorStop(0.84,Theme.amber.toString());st.addColorStop(1,Theme.accent.toString());c.strokeStyle=st;c.stroke();c.globalAlpha=1
                }
            }

            WheelHandler { target:null;onWheel:function(e){graph.forceActiveFocus();root.adjustQ(e.angleDelta.y>0?1:-1,(e.modifiers&Qt.ShiftModifier)!==0);e.accepted=true} }

            Item {
                x:root.xFor(root.bands.hpfHz)-10;y:root.topPad;width:20;height:root.plotBottom-root.topPad
                Rectangle { anchors.horizontalCenter:parent.horizontalCenter;width:1;height:parent.height;color:Theme.amber;opacity:0.24 }
                Text { anchors.left:parent.horizontalCenter;anchors.leftMargin:8;y:4;text:"HP "+root.fmtF(root.bands.hpfHz)+" Hz";color:Theme.amber;font.family:Theme.fontFamily;font.pixelSize:8;font.weight:Font.DemiBold }
                Rectangle { anchors.horizontalCenter:parent.horizontalCenter;y:root.yFor(0)-root.topPad-8;width:16;height:16;radius:8;color:"#17140B";border.width:1;border.color:Theme.amber;Text{anchors.centerIn:parent;text:"HP";color:Theme.amber;font.family:Theme.fontFamily;font.pixelSize:7;font.weight:Font.Bold} }
                MouseArea { anchors.fill:parent;cursorShape:Qt.SizeHorCursor;onPositionChanged:function(e){if(pressed){var p=mapToItem(graph,e.x,e.y);root.bands.setHpfHz(root.freqForX(p.x))}} }
            }
            Item {
                x:root.xFor(root.bands.lpfHz)-10;y:root.topPad;width:20;height:root.plotBottom-root.topPad
                Rectangle { anchors.horizontalCenter:parent.horizontalCenter;width:1;height:parent.height;color:Theme.amber;opacity:0.24 }
                Text { anchors.right:parent.horizontalCenter;anchors.rightMargin:8;y:4;text:"LP "+root.fmtF(root.bands.lpfHz)+" Hz";color:Theme.amber;font.family:Theme.fontFamily;font.pixelSize:8;font.weight:Font.DemiBold }
                Rectangle { anchors.horizontalCenter:parent.horizontalCenter;y:root.yFor(0)-root.topPad-8;width:16;height:16;radius:8;color:"#17140B";border.width:1;border.color:Theme.amber;Text{anchors.centerIn:parent;text:"LP";color:Theme.amber;font.family:Theme.fontFamily;font.pixelSize:7;font.weight:Font.Bold} }
                MouseArea { anchors.fill:parent;cursorShape:Qt.SizeHorCursor;onPositionChanged:function(e){if(pressed){var p=mapToItem(graph,e.x,e.y);root.bands.setLpfHz(root.freqForX(p.x))}} }
            }

            Repeater {
                model:bands
                delegate: Item {
                    id:node
                    required property int index
                    required property real freq
                    required property real gain
                    required property real q
                    required property string typeName
                    width:index===root.selectedIndex?23:19;height:width;x:root.xFor(freq)-width/2;y:root.yFor(gain)-height/2
                    Rectangle { anchors.centerIn:parent;width:parent.width+(index===root.selectedIndex?8:6);height:width;radius:width/2;color:root.colorFor(index);opacity:index===root.selectedIndex?0.12:0.045 }
                    Rectangle {
                        anchors.fill:parent
                        radius:width/2
                        color:index===root.selectedIndex?"#11181B":"#12100B"
                        border.width:index===root.selectedIndex?2:1
                        border.color:root.colorFor(index)
                        Text{anchors.centerIn:parent;text:index+1;color:root.colorFor(index);font.family:Theme.fontFamily;font.pixelSize:9;font.weight:Font.Bold}
                    }
                    MouseArea {
                        property real lx:0;property real ly:0
                        anchors.fill:parent;anchors.margins:-9;cursorShape:Qt.SizeAllCursor
                        onPressed:function(e){root.selectBand(index);graph.forceActiveFocus();lx=e.x;ly=e.y}
                        onPositionChanged:function(e){if(!pressed)return;var fine=(e.modifiers&Qt.ShiftModifier)!==0;if((e.modifiers&Qt.ControlModifier)!==0){var dy=e.y-ly;ly=e.y;var nq=root.clamp(q*Math.exp(-dy*(fine?0.003:0.012)),0.1,30);bands.setBand(index,freq,gain,nq);if(index===root.selectedIndex)root.selectedQ=nq;return}var p=mapToItem(graph,e.x,e.y);p.x=root.clamp(p.x,root.leftPad,graph.width-root.rightPad);p.y=root.clamp(p.y,root.topPad,root.plotBottom);var nf=root.freqForX(p.x),ng=root.gainForY(p.y);if(!fine&&Math.abs(ng)<0.3)ng=0;bands.setBand(index,nf,ng,q)}
                        onDoubleClicked:{root.selectBand(index);root.setSelectedGain(0)}
                    }
                }
            }

            Rectangle {
                width: inspector.width + 12
                height: inspector.height + 12
                x: inspector.x - 6
                y: inspector.y + 4
                radius: inspector.radius + 4
                color: "#52000000"
                opacity: 0.70
            }

            BandInspector {
                id: inspector
                bandModel: root.bands
                bandIndex: root.selectedIndex
                frequency: root.selectedFreq
                gain: root.selectedGain
                q: root.selectedQ
                accentColor: root.colorFor(root.selectedIndex)
                width: Math.min(516,graph.width-36)
                height: 64
                x: root.clamp(root.xFor(root.selectedFreq)-width/2,18,graph.width-width-18)
                y: graph.height-height-14
                Behavior on x { SmoothedAnimation { velocity:1800 } }
                onFrequencyEdited:function(v){root.setSelectedFrequency(v)}
                onGainEdited:function(v){root.setSelectedGain(v)}
                onQEdited:function(v){root.setSelectedQValue(v)}
                onResetRequested:root.resetSelected()
            }
        }

        RowLayout {
            Layout.fillWidth:true
            Layout.preferredHeight:50
            spacing:5
            Repeater {
                model:bands
                delegate: Rectangle {
                    required property int index
                    required property real freq
                    required property real gain
                    required property real q
                    required property string typeName
                    Layout.fillWidth:true
                    Layout.preferredHeight:42
                    radius:5
                    color:index===root.selectedIndex?"#141D20":"#080D11"
                    border.width:index===root.selectedIndex?1:0
                    border.color:root.colorFor(index)
                    Column {
                        anchors.fill:parent
                        anchors.margins:6
                        spacing:1
                        Row{spacing:4;Text{text:"B"+(index+1);color:index===root.selectedIndex?root.colorFor(index):Theme.textDim;font.family:Theme.fontFamily;font.pixelSize:8;font.weight:Font.Bold}Text{text:typeName==="LOW SHELF"?"LS":typeName==="HIGH SHELF"?"HS":"P";color:Theme.textFaint;font.family:Theme.fontFamily;font.pixelSize:8}}
                        Text{text:root.fmtF(freq);color:index===root.selectedIndex?Theme.amber:Theme.textSoft;font.family:Theme.fontFamily;font.pixelSize:Theme.textXS;font.weight:Font.DemiBold}
                        Text{text:(gain>0?"+":"")+gain.toFixed(1)+" dB";color:Theme.textDim;font.family:Theme.fontFamily;font.pixelSize:8}
                    }
                    MouseArea { anchors.fill:parent;cursorShape:Qt.PointingHandCursor;onClicked:root.selectBand(index) }
                }
            }
        }
    }
}
