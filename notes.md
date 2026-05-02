# Dev Notes

## Free-typing Test Results - SUCCESS
The free-typing version is working correctly:
- Counter shows "2 words modified" (star->car, diamond->pizza)
- On the original side: "star" and "diamond" show strikethrough/dimmed text
- On the parody side: "car" has an amber/gold highlight background, "pizza" has an amber/gold highlight background
- The textarea is fully editable - you just type freely and the diff detection happens automatically
- Word linking by position is working: line 1 word 4 maps to line 1 word 4, etc.

The highlight layer behind the textarea is rendering the amber backgrounds correctly. The text appears slightly bold/doubled because both the highlight layer text and the textarea text are visible. Need to fix the highlight layer to use transparent text color so only the background highlights show through.
