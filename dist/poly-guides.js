/* Original in-game guides. Algorithms checked against the site's exact engines. */
window.POLY_GUIDES = {
  pyraminx: {
    title: 'Solve the Pyraminx',
    intro: 'A complete first solve: match the tips, build the yellow base, then finish just three edges. The instructions below use this game’s fixed ring letters.',
    notation: [
      'U is the upper vertex; L, R and B are the left, right and back vertices in the starting view. Dragging the view does not rename these rings.',
      'Capital letters turn a main layer by 120°. Lowercase letters turn only its small tip. A prime (′) reverses a turn. Use the Notation moves buttons; check Inverse for a prime. Ring arrows describe on-screen motion.',
      'An edge such as UL is the two-color piece on the line between vertices U and L. The yellow base is opposite vertex U. The other three faces are green, blue and red; use their center stickers to identify them.'
    ],
    steps: [
      {
        title: '1 · Match tips and base centers',
        body: '<p>Turn <code>l</code>, <code>r</code>, <code>b</code> and <code>u</code> until each tip matches its neighboring three-color center. Then turn the main <code>L</code>, <code>R</code> and <code>B</code> layers until all three yellow center stickers face the bottom.</p><p>You now have the base’s color reference. Main turns carry their tips with them, so a tip already matched to its center stays matched.</p>'
      },
      {
        title: '2 · Insert the three yellow edges',
        body: '<p>Choose a yellow edge in the upper layer. Turn <code>U</code> until it reaches one of the setups below, then perform that insertion. Read “yellow faces red” as the yellow sticker facing the side whose center is red.</p><ol><li><strong>Yellow–green → base LR.</strong> At UL, with yellow facing red: <code>R U′ R′</code>. Or at UR, with yellow facing blue: <code>L′ U L</code>.</li><li><strong>Yellow–red → base LB.</strong> At UB, with yellow facing blue: <code>L U′ L′</code>. Or at UL, with yellow facing green: <code>B′ U B</code>.</li><li><strong>Yellow–blue → base RB.</strong> At UR, with yellow facing green: <code>B U′ B′</code>. Or at UB, with yellow facing red: <code>R′ U R</code>.</li></ol><p>If the edge you need is trapped incorrectly in the base, use either insertion for that base slot to lift it out, then set it up properly. Finish all three edges; the entire yellow face and its side stripes should match.</p>'
      },
      {
        title: '3 · Align the upper center',
        body: '<p>Turn only <code>U</code> until its three center stickers match the side centers below. If needed, match tip <code>u</code> again. Leave the yellow base untouched from here onward.</p><p>Only three edge pieces remain: <strong>UL</strong> at upper left, <strong>UR</strong> at upper right and <strong>UB</strong> at the back.</p>'
      },
      {
        title: '4 · Put those edges in their slots',
        body: '<p>Identify each edge by its two colors, ignoring which sticker points where. If their color pairs are already in the correct slots, skip to step 5.</p><p>To move the pieces <strong>UB → UL → UR → UB</strong>, use <code>L′ U L U L′ U L</code>.</p><p>For <strong>UB → UR → UL → UB</strong>, use <code>L′ U′ L U′ L′ U′ L</code>.</p><p>Pick the direction that takes a misplaced piece to its matching side colors. One of these cycles places all three pairs correctly. These sequences preserve the base, centers and tips.</p>'
      },
      {
        title: '5 · Flip the final pair',
        body: '<p>If everything matches, you are done. Otherwise exactly two of these correctly placed edges are reversed. Use the sequence for that pair:</p><ol><li><strong>UL and UR:</strong> <code>U L U′ R U′ R′ U L′</code></li><li><strong>UR and UB:</strong> <code>U R U′ B U′ B′ U R′</code></li><li><strong>UB and UL:</strong> <code>U B U′ L U′ L′ U B′</code></li></ol><p>Check all four faces. If more than two edges look wrong, recheck their color pairs and the upper center before applying another sequence.</p>'
      }
    ],
    sources: [
      {label: 'Jaap Scherphuis · Pyraminx method', url: 'https://www.jaapsch.net/puzzles/pyraminx.htm'},
      {label: 'GANCUBE · Pyraminx tutorial', url: 'https://www.gancube.com/pages/gancube-tutorials-pyraminx'},
      {label: 'Speedcube · Beginner Pyraminx', url: 'https://www.speedcube.us/blogs/speedcubing-solutions/how-to-solve-a-pyraminx-easy-to-follow-beginners-steps'}
    ]
  },
  megaminx: {
    title: 'Solve the Megaminx',
    intro: 'Build outward from the white face, then finish the slate face. This is a full layer-by-layer method with a compact last-layer toolkit. Take one piece at a time; the 3×3 guide is useful practice first.',
    notation: [
      'The game uses permanent A–L face labels. They stay fixed when you orbit. Every unprimed move is one 72° clockwise turn viewed directly from outside that face; a prime reverses it. A 2 means two turns in the stated direction, so r2 and r′2 are different.',
      'This guide uses four lowercase ROLE names, not game controls: w = working face; f and r = consecutive neighbors in clockwise order around w, viewed directly from outside w; t = the other face touching both f and r. Before a sequence, identify the actual A–L rings occupying those roles.',
      'For example, w=L, f=G, r=H and t=C is a valid frame. In that frame r w r′ means H L H′. Use the Notation moves buttons; check Inverse for a prime. Changing a guide frame only changes your letter translation; it does not turn the puzzle.'
    ],
    steps: [
      {
        title: '1 · Make the white star',
        body: '<p>Find face <strong>A · white</strong>. Place its five white edges around the white center, with the other sticker of each edge matching its neighboring center. A correct white star has five correctly colored side stickers as well as five white ones.</p><p>Route a target edge through unfinished faces. Move a solved edge aside temporarily if necessary, bring the target into its slot, then undo that temporary move. Keep an eye on the centers: they identify the destination of every color pair.</p>'
      },
      {
        title: '2 · Fill corners, then the surrounding edges',
        body: '<p><strong>Corner tool.</strong> Choose the target corner at <strong>t–f–r</strong>, with an unfinished working face w across the f–r edge. Bring its piece to <strong>w–f–r</strong> using unfinished faces. The sticker that belongs on t determines the insertion:</p><ol><li>On r: <code>r′ w′ r</code>.</li><li>On f: <code>f w f′</code>.</li><li>On w: <code>r′ w r f w′2 f′</code>.</li></ol><p>These may change the f–r edge, so complete the corners before that edge. To eject a wrong corner, insert a working-layer corner into its slot and try again.</p><p><strong>Edge tool.</strong> The target is the f–r edge. For a piece at w–r with its f color on w, use <code>w f w′ f′ w′ r′ w r</code>. For a piece at f–w with its r color on w, use <code>w′ r′ w r w f w′ f′</code>. The other sticker must match r or f, respectively. Eject a reversed edge with the same tool, then insert it correctly.</p>'
      },
      {
        title: '3 · Work around the lower half',
        body: '<p>Finish white A, then work around its neighboring faces <strong>B, C, D, E and F</strong>. Reuse the corner and edge tools, choosing an unfinished w beside each target. Reidentify the four role letters each time you move to a new slot.</p><p>Build the small groups around the lower corners of the remaining faces before filling the edges above them. Where a group is awkward to reach, turn its face one step to expose the slot, use the insertion tool, then restore that setup turn. Do not use a completed face as the working face.</p><p>When every piece that does <strong>not</strong> contain slate is correct, stop building. Only the five slate edges and five slate corners should be unsolved. The remaining working face is <strong>L · slate</strong>.</p>'
      },
      {
        title: '4 · Set the last-layer frame',
        body: '<p>Keep <strong>w = L</strong> throughout the rest of the solve. Start with <strong>f=G, r=H, t=C</strong>. Call the five neighbors of w, in clockwise order, <strong>f, r, b, B, l</strong>. In the starting frame these are <strong>G, H, I, J, K</strong>.</p><p>You may shift the reference frame around L without turning any layer. The five choices for <strong>(f, r, t)</strong> are <strong>(G,H,C), (H,I,D), (I,J,E), (J,K,F), (K,G,B)</strong>. All role letters shift together. Choose the frame that matches the case you need.</p><p>Number edge positions <strong>e0…e4</strong> clockwise from w–f. Number corners <strong>c0…c4</strong> clockwise from w–f–r. In the starting frame, the edges are <strong>LG, LH, LI, LJ, LK</strong>; the corners are <strong>LGH, LHI, LIJ, LJK, LKG</strong>.</p>'
      },
      {
        title: '5 · Turn all slate edge stickers outward',
        body: '<p>Ignore edge positions for now. An edge is oriented when its slate sticker faces L. The number needing a flip is even.</p><p>Choose a frame with a reversed edge at <strong>w–r</strong>. For an adjacent reversed partner at <strong>w–f</strong>, use <code>r w f w′ f′ r′</code>. For a nonadjacent partner at <strong>w–l</strong>, use <code>r f w f′ w′ r′</code>.</p><p>These sequences can move the last-layer edges as they flip them. Reinspect after each full sequence. Repeat for any remaining pair until all five slate edge stickers form a star.</p>'
      },
      {
        title: '6 · Put the slate edges in order',
        body: '<p>Turn w to line up as many side colors as possible. Use the position arrows below to choose a sequence, shifting the reference frame if needed. An arrow shows where the piece currently in that position will go.</p><ol><li><strong>e1 → e0 → e4 → e1:</strong> <code>r w r′ w r w′2 r′</code></li><li><strong>e1 → e4 → e0 → e1:</strong> <code>r w2 r′ w′ r w′ r′</code></li><li><strong>e1 → e0 → e3 → e1:</strong> <code>r w r′ w2 r w2 r′</code></li><li><strong>e1 → e3 → e0 → e1:</strong> <code>r w′2 r′ w′2 r w′ r′</code></li><li><strong>Swap e1/e3 and e0/e4:</strong> <code>r w r′ w r w′ r′ w2 r w2 r′</code></li></ol><p>Check the five side colors against their centers. If more than one sequence is needed, pick a cycle that sends a misplaced edge home and then re-evaluate. Once the edges match, keep them aligned.</p>'
      },
      {
        title: '7 · Put the five corners in their places',
        body: '<p>Judge a corner by its three colors; ignore its twist. Keep the edges aligned. These corner cycles leave every edge in place:</p><ol><li><strong>c0 → c4 → c3 → c0:</strong> <code>r t r′ w r t′ r′ w r t r′ w′2 r t′ r′</code></li><li><strong>c0 → c3 → c4 → c0:</strong> <code>r t r′ w2 r t′ r′ w′ r t r′ w′ r t′ r′</code></li><li><strong>c0 → c4 → c2 → c0:</strong> <code>r t r′ w r t′ r′ w2 r t r′ w2 r t′ r′</code></li><li><strong>c0 → c2 → c4 → c0:</strong> <code>r t r′ w′2 r t′ r′ w′2 r t r′ w′ r t′ r′</code></li></ol><p>Use the five reference frames from step 4 to choose any three corner positions. Pick a cycle that takes the piece you want from its present slot to its correct slot; use other misplaced corners as the other two positions where possible. Recheck after each cycle. A pair of swaps needs two cycles; a five-piece cycle also needs more than one. Continue until every corner’s three colors match the three centers around it.</p>'
      },
      {
        title: '8 · Twist the corners, in pairs',
        body: '<p>Choose a frame with a twisted corner at c0. Define two short sequences: <strong>A</strong> = <code>r t′ r′ f′ t′ f</code>, and its reverse <strong>A⁻¹</strong> = <code>f′ t f r t r′</code>.</p><p>Perform <strong>A, setup, A⁻¹, undo setup</strong>. It twists c0 anticlockwise and the chosen partner clockwise, viewed directly from outside each corner. Everything else returns to place.</p><ol><li>Partner c4: setup <code>w</code>; undo <code>w′</code>.</li><li>Partner c3: setup <code>w2</code>; undo <code>w′2</code>.</li><li>Partner c2: setup <code>w′2</code>; undo <code>w2</code>.</li><li>Partner c1: setup <code>w′</code>; undo <code>w</code>.</li></ol><p>Choose a partner needing the opposite twist. If the required directions are reversed, perform that entire pair-twist sequence twice. If the remaining corners all need the same twist, correct one with any other twisted corner as the partner, then re-evaluate; the next pair will have opposite needs. Finish each full sequence before inspecting. All twelve faces should now be uniform.</p>'
      }
    ],
    sources: [
      {label: 'Jaap Scherphuis · Megaminx', url: 'https://www.jaapsch.net/puzzles/megaminx.htm'},
      {label: 'GANCUBE · Layer-by-layer Megaminx', url: 'https://www.gancube.com/pages/megaminx-guide-of-gan'},
      {label: 'Speedcube · Megaminx beginner steps', url: 'https://www.speedcube.us/blogs/speedcubing-solutions/how-to-solve-a-megaminx-layer-by-layer-easy-to-follow-beginners-steps'},
      {label: 'Grant Tregay · Megaminx method', url: 'https://www.grantnbetty.com/cube/solutions/megaminx/'},
      {label: 'Ruwix · Megaminx solution', url: 'https://ruwix.com/twisty-puzzles/megaminx-gigaminx-teraminx-petaminx/'}
    ]
  }
};
