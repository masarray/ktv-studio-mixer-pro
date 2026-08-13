import QtQuick
import QtQuick.Layouts

StudioPanel {
    id: root
    implicitHeight: 190
    accentTop: true
    accentColor: Theme.amber

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8
        RowLayout {
            Layout.fillWidth: true
            Text { text: "DEFAULT FLAT"; color: Theme.text; font.family: Theme.fontFamily; font.pixelSize: 9; font.weight: Font.Bold; font.letterSpacing: 0.65 }
            Item { Layout.fillWidth: true }
            Rectangle { width: 7; height: 7; radius: 4; color: Theme.green }
            Text { text: "OK"; color: Theme.green; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.Bold }
        }
        Rectangle { Layout.fillWidth: true; height: 1; color: Theme.borderSoft }
        Text { text: "PRESET NAME"; color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.DemiBold; font.letterSpacing: 0.9 }
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 34
            radius: 5
            color: Theme.recessed
            border.width: 1
            border.color: Theme.borderSoft
            Text { anchors.left: parent.left; anchors.leftMargin: 10; anchors.verticalCenter: parent.verticalCenter; text: "DEFAULT FLAT"; color: Theme.amber; font.family: Theme.fontFamily; font.pixelSize: 10; font.weight: Font.Bold }
        }
        GridLayout {
            Layout.fillWidth: true
            columns: 2
            rowSpacing: 5
            Text { text: "Source"; color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 9 }
            Text { Layout.alignment: Qt.AlignRight; text: "DEFAULT FLAT"; color: Theme.textSoft; font.family: Theme.fontFamily; font.pixelSize: 9; font.weight: Font.DemiBold }
            Text { text: "Status"; color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 9 }
            Text { Layout.alignment: Qt.AlignRight; text: "CLEAN"; color: Theme.green; font.family: Theme.fontFamily; font.pixelSize: 9; font.weight: Font.DemiBold }
            Text { text: "Diff"; color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 9 }
            Text { Layout.alignment: Qt.AlignRight; text: "0 B"; color: Theme.textSoft; font.family: Theme.fontFamily; font.pixelSize: 9; font.weight: Font.DemiBold }
        }
    }
}
