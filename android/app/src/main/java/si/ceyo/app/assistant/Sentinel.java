package si.ceyo.app.assistant;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure on-device checks for bills and suspicious links. No network, no model: messages never leave the phone here. */
public final class Sentinel {
    private Sentinel() {}

    public static final class Bill {
        public final String amount; public final String currency; public final String due;
        Bill(String amount, String currency, String due) { this.amount = amount; this.currency = currency; this.due = due; }
    }

    private static final Pattern AMOUNT = Pattern.compile(
        "(?:(EGP|USD|SAR|AED|ج\\.?م|جنيه|ريال|درهم|\\$)\\s*([0-9]+(?:[.,][0-9]{1,2})?))|(?:([0-9]+(?:[.,][0-9]{1,2})?)\\s*(EGP|USD|SAR|AED|ج\\.?م|جنيه|ريال|درهم|\\$))",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern BILL_WORDS = Pattern.compile(
        "(فاتورة|فاتوره|مستحق|استحقاق|سداد|قسط|اشتراك|كهرباء|انترنت|إنترنت|غاز|مياه|bill|invoice|due|payment|installment)",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern DUE = Pattern.compile("([0-9]{1,2}[/\\-.][0-9]{1,2}(?:[/\\-.][0-9]{2,4})?)");

    /** Returns a bill only when the text names a bill AND an amount with currency. */
    public static Bill detectBill(String text) {
        if (text == null || text.length() > 2000 || !BILL_WORDS.matcher(text).find()) return null;
        Matcher m = AMOUNT.matcher(text);
        if (!m.find()) return null;
        String amount = m.group(2) != null ? m.group(2) : m.group(3);
        String cur = m.group(1) != null ? m.group(1) : m.group(4);
        Matcher d = DUE.matcher(text);
        return new Bill(amount, cur, d.find() ? d.group(1) : null);
    }

    private static final Pattern URL = Pattern.compile("(https?://[^\\s<>\"]+|www\\.[^\\s<>\"]+)", Pattern.CASE_INSENSITIVE);
    private static final String[] BRANDS = {"banquemisr", "bankmisr", "nbe", "cib", "instapay", "vodafone", "fawry", "paypal", "apple", "google", "facebook", "whatsapp", "amazon", "netflix", "binance"};
    private static final String[] RISKY_TLDS = {".zip", ".mov", ".xyz", ".top", ".click", ".icu", ".rest", ".cam", ".loan", ".tk", ".ml", ".gq", ".cf"};
    private static final String[] SHORTENERS = {"bit.ly", "tinyurl.com", "t.ly", "cutt.ly", "is.gd", "rb.gy"};

    public static List<String> links(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) return out;
        Matcher m = URL.matcher(text);
        while (m.find() && out.size() < 5) out.add(m.group(1));
        return out;
    }

    /** Returns a short reason when a link looks like phishing, or null when nothing suspicious was found. */
    public static String suspiciousReason(String link) {
        String host;
        try {
            String u = link.startsWith("http") ? link : "https://" + link;
            host = new URI(u.replaceAll("[)\\].,!?]+$", "")).getHost();
        } catch (Exception e) { return null; }
        if (host == null) return null;
        host = host.toLowerCase(Locale.ROOT);
        if (host.startsWith("xn--") || host.contains(".xn--")) return "punycode";
        if (host.matches("^[0-9.]+$")) return "ip";
        if (host.contains("@")) return "userinfo";
        for (String s : SHORTENERS) if (host.equals(s)) return "shortener";
        String flat = host.replace("-", "").replace(".", "");
        for (String b : BRANDS) {
            boolean official = host.equals(b + ".com") || host.endsWith("." + b + ".com") || host.equals(b + ".com.eg") || host.endsWith("." + b + ".com.eg");
            if (flat.contains(b) && !official) return "brand:" + b;
        }
        for (String t : RISKY_TLDS) if (host.endsWith(t)) return "tld";
        if (host.chars().filter(c -> c == '-').count() >= 3) return "hyphens";
        return null;
    }

    private static final Pattern SPEND_WORDS = Pattern.compile(
        "(خصم|تم خصم|شراء|عملية شراء|سحب|دفع|مدفوعات|purchase|debited|spent|withdrawal|paid|charged|pos)", Pattern.CASE_INSENSITIVE);
    private static final Pattern REFUND = Pattern.compile("(استرداد|إيداع|ايداع|تحويل وارد|refund|credited|deposit|received)", Pattern.CASE_INSENSITIVE);

    /** Amount spent according to a bank/wallet notification, or -1 when the text is not a purchase/debit. */
    public static double detectSpend(String text) {
        if (text == null || text.length() > 2000 || !SPEND_WORDS.matcher(text).find() || REFUND.matcher(text).find()) return -1;
        Matcher m = AMOUNT.matcher(text);
        if (!m.find()) return -1;
        String amount = m.group(2) != null ? m.group(2) : m.group(3);
        try { return Double.parseDouble(amount.replace(",", ".")); } catch (Exception e) { return -1; }
    }
}
