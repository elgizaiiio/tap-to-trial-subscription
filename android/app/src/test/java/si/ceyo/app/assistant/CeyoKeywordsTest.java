package si.ceyo.app.assistant;
import org.junit.Test;
import static org.junit.Assert.*;
public class CeyoKeywordsTest {
    @Test public void acceptsOnlyTokensFromTheActualModel() {
        assertTrue(CeyoKeywords.valid("▁HE 1\nY 2\n▁C 3\nE 4\nO 5", "▁HE Y ▁C E Y O @HEY_CEYO"));
        assertFalse(CeyoKeywords.valid("▁HE 1\nY 2", "H EY S I Y OW @CEYO"));
    }
}