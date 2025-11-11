'use strict';

/**
 * 2-opt local search algorithm for TSP improvement
 * Iteratively improves route by reversing segments
 *
 * @param {Array<number>} route - Sequence of node indices
 * @param {Array<Array<number>>} matrix - Distance/duration matrix
 * @returns {Array<number>} Improved route sequence
 */
function twoOpt(route, matrix) {
  if (!route || route.length < 4) return route; // Need at least 4 nodes for 2-opt
  if (!matrix || matrix.length === 0) return route; // No matrix = no optimization

  const seq = route.slice(); // Work on copy
  let improved = true;
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < seq.length - 2; i++) {
      for (let k = i + 1; k < seq.length - 1; k++) {
        // Check if swap improves total distance
        const a = seq[i - 1];
        const b = seq[i];
        const c = seq[k];
        const d = seq[k + 1];

        // Skip if indices out of bounds
        if (!matrix[a] || !matrix[b] || !matrix[c] || !matrix[d]) continue;

        const before = (matrix[a][b] || 0) + (matrix[c][d] || 0);
        const after = (matrix[a][c] || 0) + (matrix[b][d] || 0);

        if (after < before) {
          // Reverse segment between i and k
          const reversed = seq.slice(i, k + 1).reverse();
          seq.splice(i, k - i + 1, ...reversed);
          improved = true;
        }
      }
    }
  }

  return seq;
}

/**
 * Calculate total distance/duration of a route
 */
function calculateRouteDistance(route, matrix) {
  if (!route || route.length < 2) return 0;
  if (!matrix || matrix.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to = route[i + 1];
    if (matrix[from] && matrix[from][to] !== undefined) {
      total += matrix[from][to];
    }
  }
  return total;
}

module.exports = { twoOpt, calculateRouteDistance };
