package si.ceyo.app.assistant;

import java.util.HashSet;
import java.util.Set;

/** The model accepts its exact BPE vocabulary, not invented phoneme tokens. */
public final class CeyoKeywords {
    public static boolean valid(String vocabulary, String keywords) {
        Set<String> tokens = new HashSet<>();
        for (String line : vocabulary.split("\\r?\\n")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length >= 2) tokens.add(parts[0]);
        }
        boolean found = false;
        for (String line : keywords.split("\\r?\\n")) {
            if (line.trim().isEmpty() || line.trim().startsWith("#")) continue;
            boolean word = false;
            for (String token : line.trim().split("\\s+")) {
                if (token.startsWith("@") || token.startsWith(":" ) || token.startsWith("#")) continue;
                if (!tokens.contains(token)) return false;
                word = true;
            }
            if (!word) return false;
            found = true;
        }
        return found;
    }
}