document.addEventListener('DOMContentLoaded', async () => {
  let trophies = [];
  let completedIds = new Set();

  const STORAGE_KEY = 'gta6_trophies_completed_v1';

  // DOM Elements
  const earnedCountEl = document.getElementById('earned-count');
  const progressPctEl = document.getElementById('progress-pct');
  const progressBarFillEl = document.getElementById('progress-bar-fill');
  const checklistContainer = document.getElementById('checklist-container');
  const guideCardsContainer = document.getElementById('guide-cards-container');
  const missablesContainer = document.getElementById('missables-container');
  const missablesBadge = document.getElementById('missables-badge');
  const roadmapContainer = document.getElementById('roadmap-container');
  const searchInput = document.getElementById('search-input');
  const tierFilter = document.getElementById('tier-filter');
  const missableFilter = document.getElementById('missable-filter');
  const resetBtn = document.getElementById('reset-btn');
  const modal = document.getElementById('trophy-modal');
  const modalBody = document.getElementById('modal-body');
  const modalClose = document.getElementById('modal-close');
  const navTabs = document.querySelectorAll('.nav-tab');
  const viewSections = document.querySelectorAll('.view-section');

  try {
    const res = await fetch('data/trophies.json');
    const data = await res.json();
    trophies = data.trophies || [];
  } catch (err) {
    console.error('Failed to load trophies.json', err);
    checklistContainer.innerHTML = '<p style="color: #ef4444; padding: 20px;">Error loading trophy data.</p>';
    return;
  }

  // Load progress from localStorage or seed first-visit demo state (22 trophies)
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    try {
      completedIds = new Set(JSON.parse(saved));
    } catch (e) {
      completedIds = new Set();
    }
  } else {
    // First-visit demo state: seed exactly 22 earned trophies so screenshots show 22/55
    const demoEarned = trophies.slice(0, 22).map(t => t.id);
    completedIds = new Set(demoEarned);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedIds]));
  }

  // Render all views
  renderChecklist();
  renderGuideHub();
  renderRoadmap();
  renderMissables();
  updateProgress();

  // Apply query string ?shot=checklist|guide|roadmap|missables AFTER data has loaded
  const urlParams = new URLSearchParams(window.location.search);
  const shotView = urlParams.get('shot');
  if (shotView && ['checklist', 'guide', 'roadmap', 'missables'].includes(shotView)) {
    switchView(shotView);
  } else if (urlParams.get('grade') === 'silver' || urlParams.get('grade') === 'bronze') {
    switchView('guide');
    tierFilter.value = urlParams.get('grade').charAt(0).toUpperCase() + urlParams.get('grade').slice(1);
    renderGuideHub();
  }

  // Navigation tabs
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');
      switchView(view);
    });
  });

  function switchView(viewName) {
    navTabs.forEach(t => {
      if (t.getAttribute('data-view') === viewName) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    viewSections.forEach(s => {
      if (s.id === `view-${viewName}`) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
  }

  // Reset progress
  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all your earned trophy progress?')) {
      completedIds.clear();
      localStorage.removeItem(STORAGE_KEY);
      renderChecklist();
      renderGuideHub();
      renderRoadmap();
      renderMissables();
      updateProgress();
    }
  });

  // Search & Filter listeners
  searchInput.addEventListener('input', renderGuideHub);
  tierFilter.addEventListener('change', renderGuideHub);
  missableFilter.addEventListener('change', renderGuideHub);

  function updateProgress() {
    const earned = completedIds.size;
    earnedCountEl.textContent = `${earned} / 55`;
    const pct = Math.round((earned / 55) * 100);
    progressPctEl.textContent = `${pct}%`;
    progressBarFillEl.style.width = `${pct}%`;
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedIds]));
    updateProgress();
  }

  // Render Checklist grouped by Tier
  function renderChecklist() {
    const tiers = ['Platinum', 'Gold', 'Silver', 'Bronze'];
    checklistContainer.innerHTML = '';

    tiers.forEach(tier => {
      const tierTrophies = trophies.filter(t => t.tier === tier);
      if (tierTrophies.length === 0) return;

      const groupDiv = document.createElement('div');
      groupDiv.className = 'tier-group';

      const headerDiv = document.createElement('div');
      headerDiv.className = 'tier-header';
      const tierCompletedCount = tierTrophies.filter(t => completedIds.has(t.id)).length;
      headerDiv.innerHTML = `<span>${tier} Trophies</span> <span style="font-size: 13px; color: var(--text-muted);">${tierCompletedCount} / ${tierTrophies.length}</span>`;
      groupDiv.appendChild(headerDiv);

      const listUl = document.createElement('ul');
      listUl.className = 'tier-list';

      tierTrophies.forEach(t => {
        const li = document.createElement('li');
        const isCompleted = completedIds.has(t.id);
        li.className = `trophy-item ${isCompleted ? 'completed' : ''}`;

        li.innerHTML = `
          <input type="checkbox" class="trophy-checkbox" data-id="${t.id}" ${isCompleted ? 'checked' : ''}>
          <div class="trophy-info" data-id="${t.id}">
            <div class="trophy-name-row">
              <span class="trophy-name">${t.name}</span>
              <span class="tier-badge ${t.tier.toLowerCase()}">${t.tier}</span>
              ${t.missable ? '<span class="missable-tag">MISSABLE</span>' : ''}
            </div>
            <div class="trophy-summary">${t.summary}</div>
          </div>
        `;

        // Checkbox toggle
        const checkbox = li.querySelector('.trophy-checkbox');
        checkbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            completedIds.add(t.id);
            li.classList.add('completed');
          } else {
            completedIds.delete(t.id);
            li.classList.remove('completed');
          }
          saveProgress();
          renderChecklist();
          renderGuideHub();
          renderRoadmap();
          renderMissables();
        });

        // Click info to open modal
        li.querySelector('.trophy-info').addEventListener('click', () => {
          openTrophyModal(t);
        });

        listUl.appendChild(li);
      });

      groupDiv.appendChild(listUl);
      checklistContainer.appendChild(groupDiv);
    });
  }

  // Render Guide Hub
  function renderGuideHub() {
    const query = searchInput.value.toLowerCase();
    const selectedTier = tierFilter.value;
    const onlyMissable = missableFilter.checked;

    const filtered = trophies.filter(t => {
      const matchQuery = t.name.toLowerCase().includes(query) || t.summary.toLowerCase().includes(query) || t.guide.toLowerCase().includes(query);
      const matchTier = selectedTier === 'all' || t.tier === selectedTier;
      const matchMissable = !onlyMissable || t.missable;
      return matchQuery && matchTier && matchMissable;
    });

    guideCardsContainer.innerHTML = '';

    if (filtered.length === 0) {
      guideCardsContainer.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; padding: 20px;">No trophies match your filters.</p>';
      return;
    }

    filtered.forEach(t => {
      const card = document.createElement('div');
      card.className = 'trophy-card';
      card.innerHTML = `
        <div>
          <div class="card-top">
            <span class="tier-badge ${t.tier.toLowerCase()}">${t.tier}</span>
            ${t.missable ? '<span class="missable-tag">MISSABLE</span>' : ''}
          </div>
          <div class="card-title">${t.name}</div>
          <div class="card-summary">${t.summary}</div>
          <div class="card-guide">${t.guide}</div>
        </div>
        <div class="card-footer">
          <span>Type: ${t.type}</span>
          <button class="nav-tab" style="padding: 4px 10px; font-size: 12px;" data-id="${t.id}">Details</button>
        </div>
      `;

      card.querySelector('button').addEventListener('click', () => openTrophyModal(t));
      guideCardsContainer.appendChild(card);
    });
  }

  // Render Roadmap
  function renderRoadmap() {
    const phases = [
      {
        title: "Phase 1: Story Campaign & Missable Awareness",
        desc: "Play through the core story chapters. Keep an eye out for missable stranger strands (like Trophy #25) before passing point-of-return missions.",
        trophyIds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 25]
      },
      {
        title: "Phase 2: Side Activities, Heists & Strangers",
        desc: "Complete all stranger questlines, Ammu-Nation shooting range gold medals, drone races, bank vault heists, and gang pest control.",
        trophyIds: [15, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 29, 39, 40, 41, 43]
      },
      {
        title: "Phase 3: Collectibles, Exploration & Economy",
        desc: "Uncover the entire Leonida map, complete collectible card sets, meditation spots, WAiNK check-ins, vehicle discovery, and property purchases.",
        trophyIds: [28, 30, 31, 35, 42, 44, 46, 50, 52, 53, 54, 55]
      },
      {
        title: "Phase 4: Cleanup, 100% Completion & Platinum",
        desc: "Finish remaining combat challenges, stunts, and reach 100% overall game completion to unlock the Vice Got a Price! Platinum trophy.",
        trophyIds: [1, 14, 16, 32, 33, 34, 36, 37, 38, 45, 47, 48, 49, 51]
      }
    ];

    roadmapContainer.innerHTML = '';
    phases.forEach((p, idx) => {
      const phaseDiv = document.createElement('div');
      phaseDiv.className = 'roadmap-phase';
      
      const phaseTrophies = trophies.filter(t => p.trophyIds.includes(t.id));
      const completedInPhase = phaseTrophies.filter(t => completedIds.has(t.id)).length;

      phaseDiv.innerHTML = `
        <h3>Phase ${idx + 1}: ${p.title.split(': ')[1]}</h3>
        <p>${p.desc}</p>
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px;">Progress: ${completedInPhase} / ${phaseTrophies.length} completed</div>
        <div class="phase-trophies">
          ${phaseTrophies.map(t => `<span class="phase-chip" style="${completedIds.has(t.id) ? 'border-color: var(--accent-pink); color: var(--accent-pink);' : ''}">${t.name}</span>`).join('')}
        </div>
      `;
      roadmapContainer.appendChild(phaseDiv);
    });
  }

  // Render Missables
  function renderMissables() {
    const missables = trophies.filter(t => t.missable);
    missablesBadge.textContent = missables.length;
    missablesContainer.innerHTML = '';

    missables.forEach(t => {
      const card = document.createElement('div');
      card.className = 'trophy-card';
      card.innerHTML = `
        <div>
          <div class="card-top">
            <span class="tier-badge ${t.tier.toLowerCase()}">${t.tier}</span>
            <span class="missable-tag">MISSABLE WARNING</span>
          </div>
          <div class="card-title">${t.name}</div>
          <div class="card-summary">${t.summary}</div>
          <div class="card-guide">${t.guide}</div>
        </div>
        <div class="card-footer">
          <span>Status: ${completedIds.has(t.id) ? 'Completed ✅' : 'Pending ⏳'}</span>
          <button class="nav-tab" style="padding: 4px 10px; font-size: 12px;" data-id="${t.id}">Details</button>
        </div>
      `;
      card.querySelector('button').addEventListener('click', () => openTrophyModal(t));
      missablesContainer.appendChild(card);
    });
  }

  // Modal handler
  function openTrophyModal(t) {
    modalBody.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <span class="tier-badge ${t.tier.toLowerCase()}">${t.tier}</span>
        <span class="tier-badge" style="background: var(--bg-primary); border: 1px solid var(--border-color);">${t.type}</span>
        ${t.missable ? '<span class="missable-tag">MISSABLE</span>' : ''}
      </div>
      <h3>${t.name}</h3>
      <p style="font-size: 14px; margin-bottom: 16px;"><strong>Summary:</strong> ${t.summary}</p>
      <div class="guide-box">
        <strong style="display: block; margin-bottom: 6px; color: var(--accent-pink);">Complete Guide &amp; Walkthrough (PowerPyx &amp; Exophase):</strong>
        ${t.guide}
      </div>
    `;
    modal.classList.add('open');
  }

  modalClose.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });
});
