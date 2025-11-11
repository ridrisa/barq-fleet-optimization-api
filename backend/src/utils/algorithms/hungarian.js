'use strict';

/**
 * Hungarian Algorithm for optimal assignment problem
 * Finds minimum cost matching between N workers and N jobs
 * Time complexity: O(n³)
 */

function buildHungarianAssignments(costMatrix) {
  const n = costMatrix.length;
  if (n === 0) return [];

  // Create working copy of cost matrix
  const cost = costMatrix.map(row => [...row]);

  // Step 1: Row reduction - subtract minimum from each row
  for (let i = 0; i < n; i++) {
    const min = Math.min(...cost[i]);
    for (let j = 0; j < n; j++) {
      cost[i][j] -= min;
    }
  }

  // Step 2: Column reduction - subtract minimum from each column
  for (let j = 0; j < n; j++) {
    let min = Infinity;
    for (let i = 0; i < n; i++) {
      min = Math.min(min, cost[i][j]);
    }
    for (let i = 0; i < n; i++) {
      cost[i][j] -= min;
    }
  }

  // Initialize mask matrix (0=unmarked, 1=starred zero, 2=primed zero)
  const mask = Array.from({ length: n }, () => Array(n).fill(0));
  const rowCover = Array(n).fill(false);
  const colCover = Array(n).fill(false);

  // Step 3: Initial starring of zeros
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (cost[i][j] === 0 && !rowHasStar(mask, i) && !colHasStar(mask, j)) {
        mask[i][j] = 1; // Star this zero
      }
    }
  }

  // Cover columns with starred zeros
  coverColumnsWithStarredZeros(mask, colCover);

  // Main algorithm loop
  while (true) {
    const coveredCount = colCover.reduce((a, b) => a + (b ? 1 : 0), 0);
    if (coveredCount >= n) break; // All columns covered = solution found

    // Find an uncovered zero
    const z = findUncoveredZero(cost, rowCover, colCover);

    if (z[0] === -1) {
      // No uncovered zeros - adjust matrix
      const m = findSmallestUncovered(cost, rowCover, colCover);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (rowCover[i]) cost[i][j] += m;
          if (!colCover[j]) cost[i][j] -= m;
        }
      }
    } else {
      // Prime the uncovered zero
      mask[z[0]][z[1]] = 2;

      // Check if there's a starred zero in the same row
      const starCol = mask[z[0]].indexOf(1);
      if (starCol !== -1) {
        // Cover row, uncover column with star
        rowCover[z[0]] = true;
        colCover[starCol] = false;
      } else {
        // Augment path - found alternating path to improve solution
        augmentPath(mask, z);
        clearCovers(rowCover, colCover);
        erasePrimes(mask);
        coverColumnsWithStarredZeros(mask, colCover);
      }
    }
  }

  // Extract final assignment from starred zeros
  const result = [];
  for (let i = 0; i < n; i++) {
    const j = mask[i].indexOf(1);
    if (j !== -1) {
      result.push([i, j]);
    }
  }

  return result;
}

// Helper functions
function rowHasStar(mask, i) {
  return mask[i].includes(1);
}

function colHasStar(mask, j) {
  return mask.some(row => row[j] === 1);
}

function coverColumnsWithStarredZeros(mask, colCover) {
  const n = mask.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (mask[i][j] === 1) {
        colCover[j] = true;
      }
    }
  }
}

function findUncoveredZero(cost, rowCover, colCover) {
  const n = cost.length;
  for (let i = 0; i < n; i++) {
    if (rowCover[i]) continue;
    for (let j = 0; j < n; j++) {
      if (!colCover[j] && cost[i][j] === 0) {
        return [i, j];
      }
    }
  }
  return [-1, -1];
}

function findSmallestUncovered(cost, rowCover, colCover) {
  const n = cost.length;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    if (rowCover[i]) continue;
    for (let j = 0; j < n; j++) {
      if (!colCover[j]) {
        min = Math.min(min, cost[i][j]);
      }
    }
  }
  return min;
}

function augmentPath(mask, z0) {
  const path = [z0];

  // Build alternating path of primed and starred zeros
  while (true) {
    const r = path[path.length - 1][0];
    const starCol = mask[r].indexOf(1);
    if (starCol === -1) break; // No more stars in this row

    path.push([r, starCol]);

    // Find primed zero in this column
    const starRow = mask.findIndex(row => row[starCol] === 2);
    if (starRow === -1) break;

    path.push([starRow, starCol]);
  }

  // Augment: unstar starred zeros, star primed zeros
  for (const [r, c] of path) {
    if (mask[r][c] === 1) mask[r][c] = 0; // Unstar
    if (mask[r][c] === 2) mask[r][c] = 1; // Star
  }
}

function clearCovers(rowCover, colCover) {
  rowCover.fill(false);
  colCover.fill(false);
}

function erasePrimes(mask) {
  for (let i = 0; i < mask.length; i++) {
    for (let j = 0; j < mask.length; j++) {
      if (mask[i][j] === 2) {
        mask[i][j] = 0;
      }
    }
  }
}

module.exports = { buildHungarianAssignments };
