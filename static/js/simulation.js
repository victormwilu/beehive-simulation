// static/js/simulation.js
document.addEventListener('DOMContentLoaded', function () {
  const canvas = document.getElementById('simulation-canvas');
  const ctx = canvas.getContext('2d');

  // Load images
  const scoutBeeImg = new Image();
  const foragerBeeImg = new Image();
  const queenBeeImg = new Image();

  scoutBeeImg.src = '/static/images/bee2.png';
  foragerBeeImg.src = '/static/images/bee.png';
  queenBeeImg.src = '/static/images/queen.png';

  // Initialize simulation state
  let simulationState = null;
  let prevSimulationState = null;
  let animationFrameId = null;
  let lastUpdateTime = 0;
  const updateInterval = 200; // ms between server updates

  let imagesLoaded = 0;
  const totalImages = 3;

  // Interpolation factor for smooth animation
  let interpolationFactor = 0;

  // Check when all images are loaded
  [scoutBeeImg, foragerBeeImg, queenBeeImg].forEach(img => {
    img.onload = () => {
      imagesLoaded++;
      if (imagesLoaded === totalImages) {
        startSimulation();
      }
    };

    img.onerror = () => {
      console.warn('Image failed to load, but continuing anyway');
      imagesLoaded++;
      if (imagesLoaded === totalImages) {
        startSimulation();
      }
    };
  });

  // Start simulation loop
  function startSimulation() {
    fetchSimulationState();
    animationLoop();
  }

  // Main animation loop
  function animationLoop(timestamp) {
    if (!timestamp) timestamp = performance.now();

    // Calculate time since last update
    const elapsed = timestamp - lastUpdateTime;

    // Check if it's time to fetch new state
    if (elapsed >= updateInterval) {
      prevSimulationState = JSON.parse(JSON.stringify(simulationState));
      fetchSimulationState();
      lastUpdateTime = timestamp;
      interpolationFactor = 0;
    } else if (prevSimulationState && simulationState) {
      // Calculate interpolation factor for smooth movement
      interpolationFactor = elapsed / updateInterval;
    }

    draw();
    animationFrameId = requestAnimationFrame(animationLoop);
  }

  // Fetch current simulation state from server
  function fetchSimulationState() {
    fetch('/api/simulation/state')
      .then(response => response.json())
      .then(data => {
        if (!simulationState) {
          prevSimulationState = JSON.parse(JSON.stringify(data));
        }
        simulationState = data;
      })
      .catch(error => {
        console.error('Error fetching simulation state:', error);
      });
  }

  // Interpolate between two positions for smooth animation
  function interpolate(prev, current, factor) {
    if (!prev || !current) return current;
    return prev + (current - prev) * factor;
  }

  // Draw the simulation on canvas
  function draw() {
    if (!simulationState || !prevSimulationState) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw hive
    ctx.beginPath();
    ctx.arc(simulationState.hive.x, simulationState.hive.y, simulationState.hive.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'goldenrod';
    ctx.fill();

    // Draw paper sources
    for (let i = 0; i < simulationState.paper_sources.length; i++) {
      const paper = simulationState.paper_sources[i];
      const prevPaper = prevSimulationState.paper_sources[i];

      if (paper.remaining <= 0) continue;

      // Interpolate remaining value for smooth shrinking
      const interpolatedRemaining = interpolate(prevPaper.remaining, paper.remaining, interpolationFactor);
      const size = 10 + 30 * (interpolatedRemaining / paper.original);

      ctx.beginPath();
      ctx.arc(paper.x, paper.y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = paper.discovered ? 'rgba(255, 165, 0, 0.6)' : 'rgba(0, 128, 0, 0.6)';
      ctx.fill();

      // Draw remaining amount
      ctx.fillStyle = 'black';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(Math.floor(interpolatedRemaining), paper.x, paper.y + 5);
    }

    // Draw queen bee
    ctx.drawImage(queenBeeImg,
      simulationState.queen.x - simulationState.queen.size,
      simulationState.queen.y - simulationState.queen.size,
      simulationState.queen.size * 2,
      simulationState.queen.size * 2);

    // Draw scout bees with interpolation for smooth movement
    for (let i = 0; i < simulationState.scout_bees.length; i++) {
      const scout = simulationState.scout_bees[i];
      const prevScout = prevSimulationState.scout_bees[i];

      const x = interpolate(prevScout.x, scout.x, interpolationFactor);
      const y = interpolate(prevScout.y, scout.y, interpolationFactor);

      ctx.drawImage(scoutBeeImg, x - 10, y - 10, 20, 20);
    }

    // Draw forager bees with interpolation for smooth movement
    for (let i = 0; i < simulationState.forager_bees.length; i++) {
      const forager = simulationState.forager_bees[i];
      const prevForager = prevSimulationState.forager_bees[i];

      const x = interpolate(prevForager.x, forager.x, interpolationFactor);
      const y = interpolate(prevForager.y, forager.y, interpolationFactor);

      ctx.drawImage(foragerBeeImg, x - 10, y - 10, 20, 20);
    }

    // Draw status text
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';

    // Interpolate papers analysed value for smooth counting
    const papersAnalysed = interpolate(
      prevSimulationState.hive.papers_analysed,
      simulationState.hive.papers_analysed,
      interpolationFactor
    );

    ctx.fillText(
      `Papers Analysed: ${Math.floor(papersAnalysed)} | Fields Discovered: ${simulationState.papers_found_ids.length}/${simulationState.paper_sources.length}`,
      canvas.width / 2, 30
    );

    // If all papers are analysed, show restart message
    if (simulationState.all_papers_analysed) {
      ctx.fillStyle = 'red';
      ctx.font = '20px Arial';
      ctx.fillText('All food collected! Press \'r\' to restart.', canvas.width / 2, canvas.height / 2);
    }
  }

  // Handle keyboard events
  document.addEventListener('keydown', function (event) {
    if (event.key === 'r' || event.key === 'R') {
      resetSimulation();
    }
  });

  // Reset simulation
  function resetSimulation() {
    fetch('/api/simulation/reset', {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          console.log('Simulation reset successfully');
          // Force immediate state update
          fetchSimulationState();
        }
      })
      .catch(error => {
        console.error('Error resetting simulation:', error);
      });
  }

  // Handle UI controls
  const scoutCountSlider = document.getElementById('scout-count');
  const foragerCountSlider = document.getElementById('forager-count');
  const scoutSpeedSlider = document.getElementById('scout-speed');
  const foragerSpeedSlider = document.getElementById('forager-speed');
  const papersFoundSlider = document.getElementById('papers-found');
  const fieldRichnessSlider = document.getElementById('field-richness');

  const scoutCountValue = document.getElementById('scout-count-value');
  const foragerCountValue = document.getElementById('forager-count-value');
  const scoutSpeedValue = document.getElementById('scout-speed-value');
  const foragerSpeedValue = document.getElementById('forager-speed-value');
  const papersFoundValue = document.getElementById('papers-found-value');
  const fieldRichnessValue = document.getElementById('field-richness-value');

  // Update displayed values when sliders change
  scoutCountSlider.addEventListener('input', () => {
    scoutCountValue.textContent = scoutCountSlider.value;
  });

  foragerCountSlider.addEventListener('input', () => {
    foragerCountValue.textContent = foragerCountSlider.value;
  });

  scoutSpeedSlider.addEventListener('input', () => {
    scoutSpeedValue.textContent = scoutSpeedSlider.value;
  });

  foragerSpeedSlider.addEventListener('input', () => {
    foragerSpeedValue.textContent = foragerSpeedSlider.value;
  });

  papersFoundSlider.addEventListener('input', () => {
    papersFoundValue.textContent = papersFoundSlider.value;
  });

  fieldRichnessSlider.addEventListener('input', () => {
    fieldRichnessValue.textContent = fieldRichnessSlider.value;
  });

  // Apply changes button
  document.getElementById('apply-changes').addEventListener('click', () => {
    // Update parameters one by one
    updateParam('scout_count', parseFloat(scoutCountSlider.value));
    updateParam('forager_count', parseFloat(foragerCountSlider.value));
    updateParam('scout_speed', parseFloat(scoutSpeedSlider.value));
    updateParam('forager_speed', parseFloat(foragerSpeedSlider.value));
    updateParam('papers_found', parseFloat(papersFoundSlider.value));
    updateParam('field_richness', parseFloat(fieldRichnessSlider.value));

    // Reset simulation to apply changes
    resetSimulation();
  });

  // Reset simulation button
  document.getElementById('reset-simulation').addEventListener('click', resetSimulation);

  // Update a single parameter
  function updateParam(param, value) {
    fetch(`/api/simulation/update_params/${param}/${value}`, {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          console.log(`Parameter ${param} updated to ${value}`);
        } else {
          console.error(data.message);
        }
      })
      .catch(error => {
        console.error('Error updating parameter:', error);
      });
  }
});
