/* Complete tipless method, verified against the Tetraminx engine. */
window.TETRAMINX_GUIDES = {
  "tetraminx": {
    "title": "Solve the Tetraminx",
    "intro": "Build the yellow base, then finish the upper layer’s three edges. Tetraminx uses the Pyraminx mechanism without the four small tips. This guide uses the game’s fixed ring letters.",
    "notation": [
      "U is the upper cut corner; L, R and B are the left, right and back cut corners in the starting view. Dragging the view does not rename these rings.",
      "Each capital letter turns a main layer by 120°. A prime (′) reverses a turn. Use the Notation moves buttons; check Inverse for a prime. Ring arrows describe on-screen motion. This puzzle has no independent tip moves.",
      "An edge such as UL is the two-color piece between the U and L axes. The yellow face is opposite U. Its other three colored faces are green, blue and red. Each truncated corner has one three-color vertex piece; the dark triangular caps are not additional color faces."
    ],
    "steps": [
      {
        "title": "1 · Align the base centers",
        "body": "<p>Turn the main <code>L</code>, <code>R</code> and <code>B</code> layers until all three yellow center stickers face the bottom. Look at the three-color piece beside each dark triangular cap to find these stickers.</p><p>You now have the base’s color reference. The four caps replace the Pyraminx’s tips, so there are no small tips to match.</p>"
      },
      {
        "title": "2 · Insert the three yellow edges",
        "body": "<p>Choose a yellow edge in the upper layer. Turn <code>U</code> until it reaches one of the setups below, then perform that insertion. Read “yellow faces red” as the yellow sticker facing the side whose center is red.</p><ol><li><strong>Yellow–green → base LR.</strong> At UL, with yellow facing red: <code>R U′ R′</code>. Or at UR, with yellow facing blue: <code>L′ U L</code>.</li><li><strong>Yellow–red → base LB.</strong> At UB, with yellow facing blue: <code>L U′ L′</code>. Or at UL, with yellow facing green: <code>B′ U B</code>.</li><li><strong>Yellow–blue → base RB.</strong> At UR, with yellow facing green: <code>B U′ B′</code>. Or at UB, with yellow facing red: <code>R′ U R</code>.</li></ol><p>If the edge you need is trapped incorrectly in the base, use either insertion for that base slot to lift it out, then set it up properly. Finish all three edges; the entire yellow face and its side stripes should match.</p>"
      },
      {
        "title": "3 · Align the upper center",
        "body": "<p>Turn only <code>U</code> until its three center stickers match the side centers below. Leave the yellow base untouched from here onward.</p><p>Only three edge pieces remain: <strong>UL</strong> at upper left, <strong>UR</strong> at upper right and <strong>UB</strong> at the back.</p>"
      },
      {
        "title": "4 · Put those edges in their slots",
        "body": "<p>Identify each edge by its two colors, ignoring which sticker points where. If their color pairs are already in the correct slots, skip to step 5.</p><p>To move the pieces <strong>UB → UL → UR → UB</strong>, use <code>L′ U L U L′ U L</code>.</p><p>For <strong>UB → UR → UL → UB</strong>, use <code>L′ U′ L U′ L′ U′ L</code>.</p><p>Pick the direction that takes a misplaced piece to its matching side colors. One of these cycles places all three pairs correctly. These sequences preserve the base and centers.</p>"
      },
      {
        "title": "5 · Flip the final pair",
        "body": "<p>If everything matches, you are done. Otherwise exactly two of these correctly placed edges are reversed. Use the sequence for that pair:</p><ol><li><strong>UL and UR:</strong> <code>U L U′ R U′ R′ U L′</code></li><li><strong>UR and UB:</strong> <code>U R U′ B U′ B′ U R′</code></li><li><strong>UB and UL:</strong> <code>U B U′ L U′ L′ U B′</code></li></ol><p>Check all four faces. If more than two edges look wrong, recheck their color pairs and the upper center before applying another sequence.</p>"
      }
    ],
    "sources": [
      {
        "label": "Jaap Scherphuis · Tetraminx and Pyraminx geometry",
        "url": "https://www.jaapsch.net/puzzles/pyraminx.htm"
      },
      {
        "label": "GANCUBE · Pyraminx tutorial",
        "url": "https://www.gancube.com/pages/gancube-tutorials-pyraminx"
      },
      {
        "label": "Speedcube · Beginner Pyraminx",
        "url": "https://www.speedcube.us/blogs/speedcubing-solutions/how-to-solve-a-pyraminx-easy-to-follow-beginners-steps"
      }
    ]
  }
};
