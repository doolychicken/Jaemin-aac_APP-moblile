/**
 * study-puzzle.js — 숫자/한글/이름 퍼즐 렌더링과 드래그 동작
 */
(function () {
  function createStudyPuzzleFeature(deps) {
    const {
      currentKey,
      appMainEl,
      spotlightViewEl,
      spotlightBtnEl,
      heroEl,
      gridEl,
      helperEl,
      playPuzzleSound,
      speak,
      setupImageElement,
      render
    } = deps;
    const studyPuzzleProgress = {};

    function clearStudyPuzzleProgress() {
      Object.keys(studyPuzzleProgress).forEach((key) => delete studyPuzzleProgress[key]);
    }
    
    function renderStudyPuzzle(screen) {
      const puzzle = screen.puzzle || {};
      const slots = puzzle.slots || [];
      const pieces = puzzle.pieces || slots;
      const key = currentKey();
      if (!studyPuzzleProgress[key]) studyPuzzleProgress[key] = { matches: {} };
      const state = studyPuzzleProgress[key];
      let activePuzzleCard = null;
    
      appMainEl.classList.remove("app--spotlight");
      spotlightViewEl.style.display = "none";
      spotlightBtnEl.onclick = null;
      heroEl.style.display = "none";
      heroEl.className = "hero";
      gridEl.style.display = "";
      gridEl.innerHTML = "";
      gridEl.className = `study-puzzle${slots.length > 6 ? " study-puzzle--number" : " study-puzzle--name"}`;
      helperEl.textContent = screen.helper || "카드를 끌어서 같은 빈칸에 맞춰요.";
      helperEl.style.display = "";
    
      const matchedValues = new Set(Object.values(state.matches));
    
      function pieceByValue(value) {
        return pieces.find((piece) => String(piece.value) === String(value))
          || slots.find((slot) => String(slot.value) === String(value))
          || { label: String(value), value };
      }
    
      function isComplete() {
        return slots.every((_, index) => state.matches[index]);
      }
    
      function showMiss() {
        playPuzzleSound("miss");
        speak("여기가 아니에요");
      }
    
      function isDragGhost(el) {
        return !!el && (
          el.classList.contains("study-puzzle-card--ghost")
          || el.classList.contains("study-puzzle-card--number-ghost")
        );
      }
    
      function removeDragGhost(el) {
        if (isDragGhost(el)) el.remove();
      }
    
      function animatePuzzleMagnet(movingSourceEl, slotEl) {
        return new Promise((resolve) => {
          if (!movingSourceEl || !slotEl) return resolve();
          const start = movingSourceEl.getBoundingClientRect();
          const end = slotEl.getBoundingClientRect();
          if (!start.width || !start.height || !end.width || !end.height) return resolve();
    
          const movingEl = isDragGhost(movingSourceEl) ? movingSourceEl : movingSourceEl.cloneNode(true);
          movingEl.classList.add("study-puzzle-card--magnet");
          const pieceColor = window.getComputedStyle(movingSourceEl).getPropertyValue("--piece-color");
          if (pieceColor) movingEl.style.setProperty("--piece-color", pieceColor.trim());
          if (gridEl.classList.contains("study-puzzle--number")) {
            movingEl.classList.add("study-puzzle-card--number-ghost");
          }
    
          Object.assign(movingEl.style, {
            position: "fixed",
            left: `${start.left}px`,
            top: `${start.top}px`,
            width: `${start.width}px`,
            height: `${start.height}px`,
            zIndex: "10000",
            pointerEvents: "none",
            margin: "0",
            transform: "translate3d(0, 0, 0) scale(1)"
          });
    
          if (!movingEl.isConnected) document.body.appendChild(movingEl);
    
          const targetLeft = end.left + ((end.width - start.width) / 2);
          const targetTop = end.top + ((end.height - start.height) / 2);
          const dx = targetLeft - start.left;
          const dy = targetTop - start.top;
          const scale = Math.min(1.06, Math.max(0.82, Math.min(end.width / start.width, end.height / start.height)));
          let finished = false;
    
          function finish() {
            if (finished) return;
            finished = true;
            movingEl.removeEventListener("transitionend", finish);
            slotEl.classList.add("is-docking");
            movingEl.classList.add("is-docked");
            movingEl.style.transition = "transform 0.14s ease-out, filter 0.14s ease-out";
            movingEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale * 0.9})`;
            movingEl.style.filter = "brightness(1.08)";
            window.setTimeout(() => {
              slotEl.classList.remove("is-docking");
              movingEl.remove();
              resolve();
            }, 150);
          }
    
          movingEl.addEventListener("transitionend", (event) => {
            if (event.propertyName === "transform") finish();
          });
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              movingEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
            });
          });
          window.setTimeout(finish, 620);
        });
      }
    
      function setMatched(value, slotEl, sourceEl, movingEl = sourceEl) {
        if (!slotEl) {
          removeDragGhost(movingEl);
          return showMiss();
        }
        const index = Number(slotEl.dataset.index);
        const slot = slots[index];
        const piece = pieceByValue(value);
        if (!slot || String(slot.value) !== String(value)) {
          removeDragGhost(movingEl);
          return showMiss();
        }
    
        sourceEl?.classList.add("is-snapping");
        animatePuzzleMagnet(movingEl || sourceEl, slotEl).finally(() => {
          state.matches[index] = String(value);
          playPuzzleSound("success");
          slotEl.classList.remove("is-empty");
          slotEl.classList.add("is-filled", "is-snap");
          const main = slotEl.querySelector(".study-puzzle-slot-main");
          if (main) main.textContent = slot.label;
          sourceEl?.classList.remove("is-snapping");
          sourceEl?.classList.add("is-used");
          sourceEl?.setAttribute("disabled", "true");
    
          const completed = isComplete();
          const afterSpeech = Promise.resolve(speak(piece.speech || piece.label));
          afterSpeech.finally(() => {
            window.setTimeout(() => {
              render();
              if (completed) {
                window.setTimeout(() => speak(puzzle.completeSpeech || "퍼즐 완료! 정말 잘했어요!"), 260);
              }
            }, 180);
          });
        });
      }
    
      function addHeader() {
        if (!puzzle.image) return;
        const header = document.createElement("section");
        header.className = "study-puzzle-header";
        const imgBtn = document.createElement("button");
        imgBtn.type = "button";
        imgBtn.className = "study-puzzle-photo";
        const img = document.createElement("img");
        img.src = puzzle.image;
        img.alt = puzzle.imageLabel || puzzle.title || screen.title;
        setupImageElement(img, true);
        imgBtn.appendChild(img);
        imgBtn.addEventListener("click", () => speak(puzzle.completeSpeech || puzzle.imageLabel || screen.title));
        header.appendChild(imgBtn);
        const name = document.createElement("div");
        name.className = "study-puzzle-header-name";
        name.textContent = puzzle.imageLabel || puzzle.title || screen.title;
        header.appendChild(name);
        gridEl.appendChild(header);
      }
    
      function makeSlot(slot, index) {
        const matchedValue = state.matches[index];
        const filled = !!matchedValue;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `study-puzzle-slot${filled ? " is-filled" : " is-empty"}`;
        btn.dataset.index = String(index);
        btn.dataset.value = String(slot.value);
        btn.addEventListener("click", () => speak(filled ? (slot.speech || slot.label) : `${slot.label} 자리`));
        btn.addEventListener("dragover", (e) => {
          e.preventDefault();
          btn.classList.add("is-ready");
        });
        btn.addEventListener("dragleave", () => btn.classList.remove("is-ready"));
        btn.addEventListener("drop", (e) => {
          e.preventDefault();
          btn.classList.remove("is-ready");
          const value = e.dataTransfer.getData("text/value");
          if (!value) return showMiss();
          setMatched(value, btn, activePuzzleCard);
          activePuzzleCard = null;
        });
    
        const main = document.createElement("span");
        main.className = "study-puzzle-slot-main";
        main.textContent = slot.label;
        btn.appendChild(main);
        return btn;
      }
    
      function makeCard(piece) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "study-puzzle-card";
        btn.dataset.value = String(piece.value);
        btn.draggable = true;
        let suppressNextClick = false;
    
        function speakPiece() {
          speak(piece.speech || piece.label);
        }
    
        btn.addEventListener("dragstart", (e) => {
          activePuzzleCard = btn;
          e.dataTransfer.setData("text/value", String(piece.value));
          e.dataTransfer.effectAllowed = "move";
        });
        btn.addEventListener("dragend", () => {
          activePuzzleCard = null;
        });
        btn.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse") return;
          activePuzzleCard = btn;
          const rect = btn.getBoundingClientRect();
          let didMove = false;
          const ghost = btn.cloneNode(true);
          ghost.classList.add("study-puzzle-card--ghost");
          if (gridEl.classList.contains("study-puzzle--number")) {
            ghost.classList.add("study-puzzle-card--number-ghost");
          }
          Object.assign(ghost.style, {
            position: "fixed",
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            zIndex: "9999",
            pointerEvents: "none",
            margin: "0"
          });
          document.body.appendChild(ghost);
          btn.setPointerCapture(e.pointerId);
          btn.classList.add("is-dragging");
          e.preventDefault();
    
          function move(ev) {
            const dx = ev.clientX - e.clientX;
            const dy = ev.clientY - e.clientY;
            if ((dx * dx) + (dy * dy) > 196) didMove = true;
            ghost.style.left = `${rect.left + dx}px`;
            ghost.style.top = `${rect.top + dy}px`;
            const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".study-puzzle-slot");
            document.querySelectorAll(".study-puzzle-slot.is-ready").forEach((el) => el.classList.remove("is-ready"));
            if (didMove && target) target.classList.add("is-ready");
          }
    
          function up(ev) {
            btn.releasePointerCapture(e.pointerId);
            btn.removeEventListener("pointermove", move);
            btn.removeEventListener("pointerup", up);
            btn.removeEventListener("pointercancel", cancel);
            btn.classList.remove("is-dragging");
            const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".study-puzzle-slot");
            document.querySelectorAll(".study-puzzle-slot.is-ready").forEach((el) => el.classList.remove("is-ready"));
            suppressNextClick = true;
            if (!didMove) {
              ghost.remove();
              speakPiece();
            } else if (target) {
              setMatched(piece.value, target, btn, ghost);
            } else {
              ghost.remove();
              speakPiece();
            }
            activePuzzleCard = null;
          }
    
          function cancel() {
            btn.removeEventListener("pointermove", move);
            btn.removeEventListener("pointerup", up);
            btn.removeEventListener("pointercancel", cancel);
            btn.classList.remove("is-dragging");
            ghost.remove();
            document.querySelectorAll(".study-puzzle-slot.is-ready").forEach((el) => el.classList.remove("is-ready"));
            activePuzzleCard = null;
          }
    
          btn.addEventListener("pointermove", move);
          btn.addEventListener("pointerup", up);
          btn.addEventListener("pointercancel", cancel);
        });
        btn.addEventListener("click", () => {
          if (suppressNextClick) {
            suppressNextClick = false;
            return;
          }
          speakPiece();
        });
    
        const text = document.createElement("span");
        text.textContent = piece.label;
        btn.appendChild(text);
        return btn;
      }
    
      addHeader();
    
      const board = document.createElement("section");
      board.className = "study-puzzle-board";
      slots.forEach((slot, index) => board.appendChild(makeSlot(slot, index)));
      gridEl.appendChild(board);
    
      const tray = document.createElement("section");
      tray.className = "study-puzzle-tray";
      const trayTitle = document.createElement("div");
      trayTitle.className = "study-puzzle-tray-title";
      trayTitle.textContent = isComplete() ? "다 맞췄어요!" : "퍼즐 조각";
      tray.appendChild(trayTitle);
      const cardGrid = document.createElement("div");
      cardGrid.className = "study-puzzle-card-grid";
      pieces
        .filter((piece) => !matchedValues.has(String(piece.value)))
        .forEach((piece) => cardGrid.appendChild(makeCard(piece)));
      tray.appendChild(cardGrid);
      gridEl.appendChild(tray);
    
      const actions = document.createElement("div");
      actions.className = "study-puzzle-actions";
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "btn";
      resetBtn.textContent = "처음부터 다시";
      resetBtn.addEventListener("click", () => {
        studyPuzzleProgress[key] = { matches: {} };
        speak("처음부터 다시");
        render();
      });
      actions.appendChild(resetBtn);
      const speakBtn = document.createElement("button");
      speakBtn.type = "button";
      speakBtn.className = "btn main";
      speakBtn.textContent = "읽기";
      speakBtn.addEventListener("click", () => speak(puzzle.completeSpeech || puzzle.title || screen.title));
      actions.appendChild(speakBtn);
      gridEl.appendChild(actions);
    }
    

    return {
      clear: clearStudyPuzzleProgress,
      render: renderStudyPuzzle
    };
  }

  window.createStudyPuzzleFeature = createStudyPuzzleFeature;
})();
