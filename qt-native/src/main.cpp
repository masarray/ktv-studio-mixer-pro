#include <QFont>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>

#include "StudioEngine.h"

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    app.setApplicationName(QStringLiteral("SONKUPIK STUDIO Native UI"));
    app.setOrganizationName(QStringLiteral("MasArray"));

    // Match the current web product while using the native Windows variable font.
    QFont appFont(QStringLiteral("Segoe UI Variable Text"));
    appFont.setStyleStrategy(QFont::PreferAntialias);
    app.setFont(appFont);

    // Basic removes platform-heavy styling so every visible control is ours.
    QQuickStyle::setStyle(QStringLiteral("Basic"));

    StudioEngine studioEngine;
    if (app.arguments().contains(QStringLiteral("--engine-self-test"))) {
        studioEngine.setBass(3.5);
        studioEngine.setHpfHz(95.0);
        studioEngine.setLpType(QStringLiteral("LP LR 24"));
        studioEngine.musicEqBands()->setBand(2, 355.0, -11.1, 1.0);
        const QVariantMap band = studioEngine.musicEqBands()->get(2);
        const bool valid = qFuzzyCompare(studioEngine.bass(), 3.5)
                        && qFuzzyCompare(studioEngine.hpfHz(), 95.0)
                        && studioEngine.lpType() == QStringLiteral("LP LR 24")
                        && qFuzzyCompare(band.value(QStringLiteral("frequency")).toDouble(), 355.0)
                        && qFuzzyCompare(band.value(QStringLiteral("gain")).toDouble(), -11.1);
        return valid ? 0 : 2;
    }

    QQmlApplicationEngine engine;
    engine.setInitialProperties({{QStringLiteral("studioEngine"), QVariant::fromValue(&studioEngine)}});
    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);

    engine.loadFromModule(QStringLiteral("SonkupikStudio"), QStringLiteral("Main"));
    return app.exec();
}
