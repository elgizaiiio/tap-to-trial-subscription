package si.ceyo.app.assistant;

/** Pure retry policy: silence is normal; hard failures cannot spin forever. */
public final class CeyoListeningPolicy {
    private CeyoListeningPolicy() {}
    public static long retryDelay(int error, int failures) {
        if (error == 6 || error == 7) return 500; // speech timeout / no match
        if (error == 9 || failures >= 4) return -1; // denied / unavailable
        return Math.min(8000, 1000L << Math.max(0, failures));
    }
    /** Plain Arabic reason shown in the island so the user knows why Ceyo is not answering. */
    public static String describe(int error) {
        switch (error) {
            case 1: case 2: return "النت ضعيف";
            case 3: return "الميكروفون مستخدم أو مقفول";
            case 4: case 11: return "خدمة جوجل للكلام مش بترد";
            case 5: return "خدمة الكلام اتقفلت";
            case 6: return "مسمعتش صوت";
            case 7: return "مفهمتش";
            case 8: return "خدمة الكلام مشغولة";
            case 9: return "اسمح بالميكروفون لتطبيق Google وCeyo";
            case 10: return "طلبات كتير — استنى شوية";
            case 12: case 13: return "اللغة العربية مش متحملة في خدمة الكلام";
            default: return "مشكلة في الصوت";
        }
    }
}