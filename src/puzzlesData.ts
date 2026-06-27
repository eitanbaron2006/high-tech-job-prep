import { PuzzleItem } from "./types";

export const puzzlesData: PuzzleItem[] = [
  {
    n: 1,
    title: "בקרת כפילויות במערכת תשלומים",
    q: "קיבלת רשימת מזהי עסקאות מהיום. קבע במהירות האפשרית האם <b>עסקה כלשהי חזרה על עצמה</b> (חיוב כפול). הרשימה לא ממוינת ויכולה להיות ענקית.",
    pattern: "מפת גיבוב / Set",
    en: "Hash Set",
    tells: "\"האם ראיתי כבר את X?\" + \"במהירות האפשרית\" + רשימה לא ממוינת. set נותן בדיקה ב-<code class='inl'>O(1)</code> במקום סריקה חוזרת.",
    code: `def has_duplicate(ids):
    seen = set()
    for tid in ids:
        if tid in seen: return True
        seen.add(tid)
    return False`,
    cx: "זמן O(n) · זיכרון O(n)"
  },
  {
    n: 2,
    title: "מאגר המים הגדול ביותר",
    q: "שורה של קירות אנכיים בגבהים שונים. בחר <b>שני קירות</b> שיחזיקו ביניהם את כמות המים המקסימלית. כמות = המרחק × גובה הקיר <b>הנמוך</b> מביניהם.",
    pattern: "שני מצביעים",
    en: "Two Pointers",
    tells: "בוחרים <b>זוג</b> מקצוות + אופטימום. מתחילים ברוחב מקסימלי ומזיזים פנימה את הקיר הנמוך — רק הוא יכול לשפר. חוסך בדיקת כל הזוגות.",
    code: `def max_area(heights):
    lo, hi = 0, len(heights) - 1; best = 0
    while lo < hi:
        h = min(heights[lo], heights[hi])
        best = max(best, h * (hi - lo))
        if heights[lo] < heights[hi]: lo += 1
        else: hi -= 1
    return best`,
    cx: "זמן O(n) · זיכרון O(1)"
  },
  {
    n: 3,
    title: "טיפוס במסלול הרים",
    q: "מסלול עם מדרגות, לכל אחת \"עלות אנרגיה\". אפשר לעלות 1 או לדלג 2 מדרגות. מהי <b>העלות הכוללת המינימלית</b> להגיע לראש? (אפשר להתחיל מ-0 או מ-1 בחינם.)",
    pattern: "תכנון דינמי",
    en: "Dynamic Programming",
    tells: "\"עלות מינימלית\" + בחירה מצטברת (1 או 2) שמשפיעה על ההמשך. העלות למדרגה תלויה בשתיים שלפניה → תת-בעיות חופפות.",
    code: `def min_cost(cost):
    a, b = 0, 0
    for i in range(2, len(cost) + 1):
        a, b = b, min(b + cost[i-1], a + cost[i-2])
    return b`,
    cx: "זמן O(n) · זיכרון O(1)"
  },
  {
    n: 4,
    title: "היום הירוק הבא בבורסה",
    q: "סדרת מחירי מניה יומיים. לכל יום, מצא את <b>היום הקרוב הבא</b> שבו המחיר <b>גבוה יותר</b> (אם אין — ‎-1‎). פתרון נאיבי סורק קדימה לכל יום.",
    pattern: "מחסנית מונוטונית",
    en: "Monotonic Stack",
    tells: "\"האיבר <b>הבא</b> שגדול ממני\" + נאיבי \"לכל אחד תסרוק קדימה\" (<code class='inl'>O(n²)</code>). מחסנית ימים שמחכים; יום גבוה הוא התשובה לכולם.",
    code: `def next_higher_day(prices):
    res = [-1] * len(prices); stack = []
    for i, p in enumerate(prices):
        while stack and prices[stack[-1]] < p:
            res[stack.pop()] = i
        stack.append(i)
    return res`,
    cx: "זמן O(n) · זיכרון O(n)"
  },
  {
    n: 5,
    title: "חלון השידור החזק ביותר",
    q: "חיישן מדווח ערך כל שנייה לאורך שעה. מצא את <b>חלון 5 השניות הרציף</b> עם הממוצע הגבוה ביותר. (גודל החלון קבוע.)",
    pattern: "חלון מחליק (גודל קבוע)",
    en: "Fixed Sliding Window",
    tells: "\"חלון <b>רציף</b>\" + \"<b>גודל קבוע</b>\" + אופטימום. מחשבים: מוסיפים נכנס, מחסירים יוצא. סכום מקסימלי = ממוצע מקסימלי.",
    code: `def max_avg(nums, k):
    window = sum(nums[:k]); best = window
    for i in range(k, len(nums)):
        window += nums[i] - nums[i-k]
        best = max(best, window)
    return best / k`,
    cx: "זמן O(n) · זיכרון O(1)"
  },
  {
    n: 6,
    title: "תור הטיפול בחדר מיון",
    q: "בחדר מיון, כל חולה מקבל ציון חומרה בהגעתו. בכל רגע מטפלים ב<b>חמור ביותר</b> שממתין. חולים מגיעים כל הזמן. תכנן מבנה ל\"הוסף\" ו\"מי הבא\".",
    pattern: "ערימה / תור עדיפויות",
    en: "Heap / Priority Queue",
    tells: "\"תמיד צריך את הקיצוני הנוכחי\" + הכנסות בזמן אמת. ערימה: שליפת מקסימום והוספה ב-<code class='inl'>O(log n)</code>. ממיין מלא = בזבוז.",
    code: `import heapq
class ER:
    def __init__(self): self.h = []; self.t = 0
    def admit(self, name, severity):
        heapq.heappush(self.h, (-severity, self.t, name))
        self.t += 1
    def treat_next(self):
        return heapq.heappop(self.h)[2]`,
    cx: "הוספה O(log n) · שליפה O(log n)"
  },
  {
    n: 7,
    title: "דרגות ההיכרות ברשת חברתית",
    q: "ברשת חברתית, בהינתן שני אנשים, מצא את <b>מספר הקשרים המינימלי</b> בשרשרת ההיכרויות ביניהם. הקשרים אינם ממושקלים.",
    pattern: "סריקה לרוחב",
    en: "BFS",
    tells: "\"מסלול <b>קצר ביותר</b>\" + גרף <b>ללא משקלים</b>. BFS סורק שכבה-שכבה ומוצא מרחק מינימלי טבעית.",
    code: `from collections import deque
def degrees(graph, start, target):
    if start == target: return 0
    visited = {start}; q = deque([(start, 0)])
    while q:
        person, d = q.popleft()
        for friend in graph[person]:
            if friend == target: return d + 1
            if friend not in visited:
                visited.add(friend); q.append((friend, d + 1))
    return -1`,
    cx: "זמן O(צמתים + קשתות)"
  },
  {
    n: 8,
    title: "החיפוש ביומן שנקרע ואוחה",
    q: "מערך שהיה ממוין אבל \"סובב\" בנקודה לא ידועה (למשל <code class='inl'>[4,5,6,1,2,3]</code>). מצא ערך בתוכו ב-<code class='inl'>O(log n)</code> — בלי לעבור על הכל.",
    pattern: "חיפוש בינארי (וריאציה)",
    en: "Modified Binary Search",
    tells: "הדרישה <code class='inl'>O(log n)</code> + מערך ממוין (גם אם \"שבור\"). בכל חצי אחד הצדדים ממוין רגיל — מזהים ומחליטים לאן.",
    code: `def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target: return mid
        if nums[lo] <= nums[mid]:
            if nums[lo] <= target < nums[mid]: hi = mid - 1
            else: lo = mid + 1
        else:
            if nums[mid] < target <= nums[hi]: lo = mid + 1
            else: hi = mid - 1
    return -1`,
    cx: "זמן O(log n) · זיכרון O(1)"
  },
  {
    n: 9,
    title: "בדיקת ערבוב אותיות",
    q: "שתי מילים. בדוק אם השנייה היא <b>ערבוב מחדש של אותן אותיות</b> בדיוק (אנגרמה) — אותן אותיות, אותו מספר הופעות, בסדר אחר.",
    pattern: "מפת גיבוב (ספירת תדירויות)",
    en: "Hash Map",
    tells: "\"אותן אותיות, אותו מספר הופעות\" = השוואת <b>תדירויות</b>. אנגרמות אם ורק אם מפות הספירה זהות.",
    code: `from collections import Counter
def is_anagram(s, t):
    return Counter(s) == Counter(t)`,
    cx: "זמן O(n) · זיכרון O(אלפבית)"
  },
  {
    n: 10,
    title: "המרחק המדויק בין מדידות",
    q: "מערך <b>ממוין</b> של מדידות טמפרטורה. קבע אם קיימות <b>שתי מדידות</b> שההפרש ביניהן בדיוק <code class='inl'>K</code>.",
    pattern: "שני מצביעים",
    en: "Two Pointers",
    tells: "מערך <b>ממוין</b> + זוג שמקיים תנאי על ההפרש. ההפרש קטן מדי → מרחיבים, גדול מדי → מכווצים. מנצל את המיון.",
    code: `def has_diff_k(arr, k):
    lo, hi = 0, 1
    while hi < len(arr):
        diff = arr[hi] - arr[lo]
        if diff == k and lo != hi: return True
        elif diff < k: hi += 1
        else:
            lo += 1
            if lo == hi: hi += 1
    return False`,
    cx: "זמן O(n) · זיכרון O(1)"
  },
  {
    n: 11,
    title: "המקטע המגוון-מתון בגנום",
    q: "מחרוזת ארוכה. מצא את אורך ה<b>מקטע הרציף הארוך ביותר</b> שמכיל <b>לכל היותר 2 תווים שונים</b>.",
    pattern: "חלון מחליק (גודל משתנה)",
    en: "Variable Sliding Window",
    tells: "\"מקטע <b>רציף</b> הכי <b>ארוך</b>\" + תנאי חוקיות. מרחיבים ימינה; מפר את התנאי → מכווצים משמאל עד חוקי. מפת תדירות סופרת תווים שונים.",
    code: `from collections import defaultdict
def longest_two(s):
    count = defaultdict(int); lo = 0; best = 0
    for hi in range(len(s)):
        count[s[hi]] += 1
        while len(count) > 2:
            count[s[lo]] -= 1
            if count[s[lo]] == 0: del count[s[lo]]
            lo += 1
        best = max(best, hi - lo + 1)
    return best`,
    cx: "זמן O(n) · זיכרון O(1)"
  },
  {
    n: 12,
    title: "מגמת השיא הארוכה ביותר",
    q: "סדרת מספרים. מצא את אורך תת-הסדרה <b>העולה</b> הארוכה ביותר — מספרים שעולים בהדרגה, <b>לא בהכרח רציפים</b> (אפשר לדלג).",
    pattern: "תכנון דינמי",
    en: "Dynamic Programming",
    tells: "\"הכי ארוך\" + \"<b>לא בהכרח רציף</b>\" (אפשר לדלג) → לא חלון מחליק! <code class='inl'>dp[i]</code> = אורך הסדרה שמסתיימת ב-i. (יש גם O(n log n).)",
    code: `def lis(nums):
    if not nums: return 0
    dp = [1] * len(nums)
    for i in range(len(nums)):
        for j in range(i):
            if nums[j] < nums[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)`,
    cx: "זמן O(n²) · זיכרון O(n)"
  },
  {
    n: 13,
    title: "מבוך החדרים והמפתחות",
    q: "n חדרים נעולים, מלבד חדר 0. בכל חדר מפתחות לחדרים אחרים. החל מחדר 0 — האם אפשר <b>לבקר בכל החדרים</b>?",
    pattern: "סריקה לעומק",
    en: "DFS",
    tells: "\"האם אפשר להגיע לכל...\" + צמתים (חדרים) וקשתות (מפתחות) = בעיית <b>קשירות</b>. DFS צולל, אוסף מפתחות, מסמן ביקורים.",
    code: `def can_visit_all(rooms):
    visited = set(); stack = [0]
    while stack:
        room = stack.pop()
        if room in visited: continue
        visited.add(room)
        for key in rooms[room]:
            if key not in visited: stack.append(key)
    return len(visited) == len(rooms)`,
    cx: "זמן O(חדרים + מפתחות)"
  },
  {
    n: 14,
    title: "הלקוחות הקרובים ביותר לחנות",
    q: "נקודות (קואורדינטות לקוחות) על מפה. מצא את <b>K הלקוחות הקרובים ביותר</b> לחנות בראשית הצירים. אין צורך למיין את כולם.",
    pattern: "ערימה",
    en: "Heap",
    tells: "\"<b>K הכי</b> קרובים/גדולים/נפוצים\". ערימה בגודל K יעילה ממיון מלא. (אפשר להשוות מרחקים בריבוע, בלי שורש.)",
    code: `import heapq
def k_closest(points, k):
    return heapq.nsmallest(
        k, points,
        key=lambda p: p[0]**2 + p[1]**2)`,
    cx: "זמן O(n log k) · זיכרון O(k)"
  },
  {
    n: 15,
    title: "טווח הירידה לפני השיא",
    q: "מחירי מניה יומיים. לכל יום, חשב <b>כמה ימים רצופים אחורה</b> (כולל היום) שבהם המחיר היה <b>נמוך או שווה</b> למחיר היום.",
    pattern: "מחסנית מונוטונית",
    en: "Monotonic Stack",
    tells: "\"כמה ימים רצופים אחורה עד ש...\" = חיפוש הגבול (הקודם שגדול ממני). מחסנית מחירים יורדים; המרחק לראש שנשאר הוא המוטה.",
    code: `def stock_span(prices):
    res = [0] * len(prices); stack = []
    for i, p in enumerate(prices):
        while stack and prices[stack[-1]] <= p:
            stack.pop()
        res[i] = i + 1 if not stack else i - stack[-1]
        stack.append(i)
    return res`,
    cx: "זמן O(n) · זיכרון O(n)"
  },
  {
    n: 16,
    title: "תכנון קו הייצור",
    q: "מספר מכונות; כל אחת מייצרת פריט כל <code class='inl'>t</code> דקות (קצב שונה), כולן במקביל. מהו ה<b>זמן המינימלי</b> לייצר לפחות <code class='inl'>N</code> פריטים?",
    pattern: "חיפוש בינארי על התשובה",
    en: "Binary Search on the Answer",
    tells: "\"הזמן <b>המינימלי</b> לעמוד ביעד\" + קל <b>לבדוק</b> \"האם בזמן T מספיק?\". מונוטוני (יותר זמן → יותר פריטים), אז בינארי על טווח הזמן.",
    code: `def min_time(machines, n):
    def produced(T):
        return sum(T // t for t in machines)
    lo, hi = 1, min(machines) * n
    while lo < hi:
        mid = (lo + hi) // 2
        if produced(mid) >= n: hi = mid
        else: lo = mid + 1
    return lo`,
    cx: "זמן O(מכונות · log(טווח))"
  }
];
