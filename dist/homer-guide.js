/* Original shape-based instructions; the three move tools are checked against
 * the same exact 2×2 corner engine used by the game. */
(function () {
  'use strict';
  window.HOMER_GUIDES = {
    homer: {
      title: 'Homer · put the head back together',
      intro: 'Eight pieces form one head. Rebuild the lower half, put the upper sections in their places, then turn those sections until the face and silhouette join smoothly.',
      notation: [
        "U / D / F / B / R / L mean up / down / front / back / right / left in the game’s fixed frame. A letter means a clockwise quarter-turn when looking straight at that side; ' reverses it and 2 means two quarter-turns. Use the Notation moves buttons and the Inverse checkbox.",
        'The finished head has its forehead toward U, neck toward D and face toward F. R is the right side of the screen when looking straight at F—not Homer’s anatomical right. UFR means the slot where U, F and R meet. Every move carries four whole pieces, including all their facial features.',
        'Dragging the camera does not rename the moves. “Working front” below is a substitution for an algorithm: choose the row for the side you are working on, then replace its letters. U and D stay unchanged.<table><thead><tr><th>Working front</th><th>F</th><th>R</th><th>B</th><th>L</th></tr></thead><tbody><tr><th>F</th><td>F</td><td>R</td><td>B</td><td>L</td></tr><tr><th>R</th><td>R</td><td>B</td><td>L</td><td>F</td></tr><tr><th>B</th><td>B</td><td>L</td><td>F</td><td>R</td></tr><tr><th>L</th><td>L</td><td>F</td><td>R</td><td>B</td></tr></tbody></table>',
        'The ring map is an optional learning aid: its solid colors mark the six directions of the underlying 2×2 mechanism, not the yellow, white or tan of the face. Mirror mode removes those clues and the ring map. The shape-based steps below still apply.'
      ],
      steps: [
        {
          title: 'Recognize the eight sections',
          body: '<p>The vertical front seam separates the two eyes and halves of the nose and muzzle. The horizontal seam runs below the eyes, near the bottom of the nose. The two upper-front pieces carry the eyes and forehead; the two lower-front pieces carry the tan muzzle, mouth and front of the white collar. The back pieces continue the curved skull and neck. The ear contours help distinguish the sides.</p><p>Imagine the finished head in the fixed frame: forehead up, neck down, face forward. A section belongs in a particular quarter of either the upper or lower half. Its <strong>place</strong> is that quarter; its <strong>twist</strong> is how its eye, ear, neck or curved surface faces. Check the side and back contours as well as the front.</p><p>With the ring map visible, a piece has three virtual direction colors. Yellow identifies a lower-half piece, white an upper-half piece. The other two identify its sides. These are only extra clues: in Mirror mode, follow the feature shapes and matching surface contours instead.</p>'
        },
        {
          title: 'Rebuild the lower head',
          body: '<p>Start with either lower-front section. Its muzzle faces F and its collar points D. Find the piece and decide whether its correct slot is DFR or DFL. Then repeat the following process for all four lower sections, matching the neck, muzzle and ear/back contours.</p><ol><li>If the wanted piece is already correctly placed and turned, leave it. If it is in D but misplaced or twisted, choose the working front that puts its <em>current</em> slot at DFR. Perform one complete block below to lift it into U.</li><li>Turn U until the piece sits directly above its intended lower slot. Choose the working front that puts that <em>destination</em> at DFR.</li><li>Repeat <code>R U R\' U\'</code>, checking only after each complete four-move block, until the piece fits the lower head in the correct orientation. It may take several blocks.</li></ol><p>This tool preserves the other three lower slots. Change the working front for each destination using the table above. Finish with four lower pieces that join into a continuous neck and lower head; a matching front alone is not enough.</p>'
        },
        {
          title: 'Put the upper sections in their places',
          body: '<p>Leave twist for the next step. Identify which upper-front section belongs over each half of the muzzle, and which upper-back section continues each side of the skull. A piece counts as correctly placed even if its eye or curved crown currently points the wrong way.</p><ol><li><strong>Four correct:</strong> go to the next step.</li><li><strong>None correct:</strong> turn U until at least one is correct, then recount.</li><li><strong>One correct:</strong> choose the working front that puts it at UFR.</li><li><strong>Two adjacent correct:</strong> turn U until exactly one is correct, then put that one at working UFR.</li><li><strong>Two diagonal correct:</strong> use F as the working front.</li></ol><p>Perform <code>U R U\' L\' U R\' U\' L</code>, using the chosen working-front row. It keeps the UFR piece and the entire lower head in place while cycling the other three upper pieces. Recount and follow the cases again until all four upper sections occupy their intended quarters. They can still be twisted.</p>'
        },
        {
          title: 'Untwist the face and crown',
          body: '<p><strong>Use F as the working front for this entire step.</strong> Inspect the piece at UFR. Its crown surface must point upward, its front contour toward F, and its side contour toward R. For an eye-bearing piece, the eye faces forward and its forehead is above it.</p><p>If that piece is twisted, repeat <code>R\' D\' R D</code> until that same piece is back at UFR with its own crown surface facing U. Check only after a complete four-move block; a twisted piece takes two or four blocks. It briefly moves down before returning to the working slot. The lower head will temporarily come apart. Keep going.</p><p>Turn U once to bring the next upper piece to the same UFR working slot. Repeat the block if needed, again putting that piece’s original crown surface upward. It will be in a temporary quarter, so do not try to match its identity to the lower head yet. Continue through all four upper pieces, making one U turn after each—including a piece that needed no twisting and the fourth piece.</p><p>After those four U turns, the upper sections return to their correct places and the lower head comes back together. Do not turn the camera into a new working front or repair the lower pieces halfway through this step.</p>'
        },
        {
          title: 'Check the whole head',
          body: '<p>Orbit the view. The eyes and forehead should sit above a joined nose and muzzle, the mouth should form one line, the ears should meet their neighboring surfaces, and the neck and collar should be continuous. The back of the skull matters too.</p><p>In Mirror mode, inspect those same physical joins and the complete silhouette; every feature is still part of its moving piece even without its color. The optional ring map can help locate a mistake when learning. Switching the mode preserves your current position.</p><p>If a final-twist sequence seemed to scramble the lower head, first check that you finished every four-move block and visited all four upper slots. Undo can recover a missed move. Auto solve opens the Constrained Solver and works from the current arrangement, pausing between stages and highlighting solved nodes that later stages protect. It does not need recorded moves or promise the shortest solution; difficult states may reach the computation limit.</p>'
        }
      ],
      sources: [
        { label: 'Jaap’s Puzzle Page — Mini Cube and Homer puzzle-head mechanism', url: 'https://www.jaapsch.net/puzzles/cube2.htm' }
      ]
    }
  };
})();
