import QtQuick

QtObject {
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
    function dbToLin(db) { return Math.pow(10, db / 20) }
    function safeQ(q) { return clamp(Number(q) || 0.7, 0.1, 30) }

    function peakingCoeffs(freq, q, gainDb) {
        var sr = 48000
        var A = dbToLin(gainDb / 2)
        var w0 = 2 * Math.PI * clamp(freq, 1, sr / 2 - 1) / sr
        var alpha = Math.sin(w0) / (2 * safeQ(q))
        var cw = Math.cos(w0)
        var a0 = 1 + alpha / A
        return {
            b0: (1 + alpha * A) / a0,
            b1: (-2 * cw) / a0,
            b2: (1 - alpha * A) / a0,
            a1: (-2 * cw) / a0,
            a2: (1 - alpha / A) / a0
        }
    }

    function shelfCoeffs(freq, q, gainDb, highShelf) {
        var sr = 48000
        var A = dbToLin(gainDb / 2)
        var w0 = 2 * Math.PI * clamp(freq, 1, sr / 2 - 1) / sr
        var cw = Math.cos(w0)
        var sw = Math.sin(w0)
        var slope = clamp(safeQ(q), 0.1, 10)
        var radicand = (A + 1 / A) * (1 / slope - 1) + 2
        var alpha = sw / 2 * Math.sqrt(Math.max(0.000001, radicand))
        var beta = 2 * Math.sqrt(A) * alpha
        var a0
        if (!highShelf) {
            a0 = (A + 1) + (A - 1) * cw + beta
            return {
                b0: (A * ((A + 1) - (A - 1) * cw + beta)) / a0,
                b1: (2 * A * ((A - 1) - (A + 1) * cw)) / a0,
                b2: (A * ((A + 1) - (A - 1) * cw - beta)) / a0,
                a1: (-2 * ((A - 1) + (A + 1) * cw)) / a0,
                a2: ((A + 1) + (A - 1) * cw - beta) / a0
            }
        }
        a0 = (A + 1) - (A - 1) * cw + beta
        return {
            b0: (A * ((A + 1) + (A - 1) * cw + beta)) / a0,
            b1: (-2 * A * ((A - 1) + (A + 1) * cw)) / a0,
            b2: (A * ((A + 1) + (A - 1) * cw - beta)) / a0,
            a1: (2 * ((A - 1) - (A + 1) * cw)) / a0,
            a2: ((A + 1) - (A - 1) * cw - beta) / a0
        }
    }

    function biquadMagDb(coeff, freq) {
        var sr = 48000
        var omega = 2 * Math.PI * clamp(freq, 1, sr / 2 - 1) / sr
        var c1 = Math.cos(omega), s1 = Math.sin(omega)
        var c2 = Math.cos(2 * omega), s2 = Math.sin(2 * omega)
        var bRe = coeff.b0 + coeff.b1 * c1 + coeff.b2 * c2
        var bIm = -(coeff.b1 * s1 + coeff.b2 * s2)
        var aRe = 1 + coeff.a1 * c1 + coeff.a2 * c2
        var aIm = -(coeff.a1 * s1 + coeff.a2 * s2)
        var m2 = (bRe * bRe + bIm * bIm) / Math.max(1e-12, aRe * aRe + aIm * aIm)
        return 10 * Math.log(Math.max(m2, 1e-12)) / Math.LN10
    }

    function bandResponse(band, freq) {
        if (!band || Math.abs(band.gain) < 0.001) return 0
        var type = String(band.typeName || "BELL").toUpperCase()
        var coeff
        if (type.indexOf("LOW") >= 0 || type === "LS")
            coeff = shelfCoeffs(band.freq, band.q, band.gain, false)
        else if (type.indexOf("HIGH") >= 0 || type === "HS")
            coeff = shelfCoeffs(band.freq, band.q, band.gain, true)
        else
            coeff = peakingCoeffs(band.freq, band.q, band.gain)
        return biquadMagDb(coeff, freq)
    }

    function besselMagnitude(order, normalizedFrequency) {
        var coeffs = order === 4 ? [105,105,45,10,1] : order === 3 ? [15,15,6,1] : [3,3,1]
        var scale = order === 4 ? 2.113917674904216 : order === 3 ? 1.7556723686812106 : 1.3616541287161308
        var x = Math.max(0, normalizedFrequency) * scale
        var re = 0, im = 0
        for (var p = 0; p < coeffs.length; ++p) {
            var mag = coeffs[p] * Math.pow(x, p)
            var phase = p * Math.PI / 2
            re += mag * Math.cos(phase)
            im += mag * Math.sin(phase)
        }
        return coeffs[0] / Math.max(1e-12, Math.sqrt(re * re + im * im))
    }

    function crossoverFilterDb(kind, typeLabel, cutoff, freq) {
        var label = String(typeLabel || "Butter 12").toUpperCase()
        var order = label.indexOf("24") >= 0 ? 4 : label.indexOf("18") >= 0 ? 3 : 2
        var ratio = kind === "lpf" ? Math.max(freq,1) / Math.max(cutoff,1) : Math.max(cutoff,1) / Math.max(freq,1)
        var magnitude
        if (label.indexOf("BESSEL") >= 0) magnitude = besselMagnitude(order, ratio)
        else if (label.indexOf("LR") >= 0) {
            var butter12 = 1 / Math.sqrt(1 + Math.pow(ratio, 4))
            magnitude = butter12 * butter12
        } else magnitude = 1 / Math.sqrt(1 + Math.pow(ratio, 2 * order))
        return 20 * Math.log(Math.max(magnitude, 1e-12)) / Math.LN10
    }

    function crossoverResponse(model, freq) {
        var db = 0
        var hp = Number(model.hpfHz) || 20
        var lp = Number(model.lpfHz) || 20000
        if (hp > 20.001) db += crossoverFilterDb("hpf", model.hpType, hp, freq)
        if (lp < 19999.999) db += crossoverFilterDb("lpf", model.lpType, lp, freq)
        return db
    }

    function compositeResponse(model, freq) {
        var sum = crossoverResponse(model, freq)
        for (var i = 0; i < model.count; ++i) sum += bandResponse(model.get(i), freq)
        return clamp(sum, -48, 48)
    }
}
