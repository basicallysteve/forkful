/* ============================================================
   Reusable self-check quiz widget.
   Usage in a lesson:
     <div class="quiz" data-answer="2">
       <div class="q">Question text?</div>
       <button class="opt">Option zero</button>
       <button class="opt">Option one</button>
       <button class="opt">Option two</button>
       <div class="fb" data-correct="Why it's right." data-wrong="Nudge."></div>
     </div>
   data-answer is the 0-based index of the correct <button class="opt">.
   Retrieval practice: feedback is immediate and automatic.
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".quiz").forEach((quiz) => {
    const answer = parseInt(quiz.dataset.answer, 10);
    const opts = [...quiz.querySelectorAll(".opt")];
    const fb = quiz.querySelector(".fb");
    let done = false;
    opts.forEach((opt, i) => {
      opt.addEventListener("click", () => {
        if (done) return;
        done = true;
        opts.forEach((o, j) => {
          if (j === answer) o.classList.add("correct");
          else if (j === i) o.classList.add("wrong");
          o.style.cursor = "default";
        });
        const right = i === answer;
        if (fb) {
          fb.textContent = right
            ? (fb.dataset.correct || "Correct.")
            : (fb.dataset.wrong || "Not quite — the highlighted answer is correct.");
          fb.classList.add(right ? "correct" : "wrong");
        }
      });
    });
  });
});
