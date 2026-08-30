// Isolation Forest — unsupervised anomaly detection (Liu, Ting & Zhou, 2008).
//
// Why this algorithm specifically: it needs NO labelled examples of what a
// "fault" looks like -- it isolates points by recursively splitting feature
// space on random features at random thresholds. A point that sits apart
// from the rest of the data gets separated in very few random splits (a
// short average path length across many independently-built trees); a
// point embedded deep in a dense, "normal" region takes many more splits to
// isolate. That path-length property is exactly what "this reading looks
// unlike this machine's own operating history" needs, and it can be trained
// entirely on this machine's own unlabelled current readings -- no labelled
// real-world fault dataset required (this project doesn't have one -- see
// AI_MODEL_STATUS in anomaly.ts).
//
// This is a genuine implementation of the published algorithm, not a lookup
// table dressed up as ML: random subsampling, random-split binary trees,
// path-length scoring normalized by the expected path length of a
// same-sized random search (the c(n) term below).

export type FeatureVector = number[];

interface TreeNode {
  splitFeature?: number;
  splitValue?: number;
  left?: TreeNode;
  right?: TreeNode;
  size: number; // points that reached this node at fit time
}

// Deterministic PRNG (mulberry32) seeded from the caller's key, so refitting
// on the same machine + same sample count produces a stable score instead of
// the severity badge flickering between renders on pure chance.
function mulberry32(seed: number) {
  let s = seed | 0;
  return function random() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DEFAULT_SUBSAMPLE_SIZE = 256; // standard default from the paper
const DEFAULT_NUM_TREES = 80; // fewer than the usual 100 -- this fits in-browser on every snapshot recompute

function buildTree(points: FeatureVector[], depth: number, maxDepth: number, rand: () => number): TreeNode {
  if (depth >= maxDepth || points.length <= 1) {
    return { size: points.length };
  }

  const numFeatures = points[0].length;
  const splitFeature = Math.floor(rand() * numFeatures);

  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const v = p[splitFeature];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return { size: points.length };

  const splitValue = min + rand() * (max - min);
  const left: FeatureVector[] = [];
  const right: FeatureVector[] = [];
  for (const p of points) {
    (p[splitFeature] < splitValue ? left : right).push(p);
  }
  if (left.length === 0 || right.length === 0) return { size: points.length };

  return {
    splitFeature,
    splitValue,
    size: points.length,
    left: buildTree(left, depth + 1, maxDepth, rand),
    right: buildTree(right, depth + 1, maxDepth, rand),
  };
}

// c(n): average path length of an unsuccessful search in a binary search
// tree of n nodes -- the normalization constant from the paper.
function averagePathLengthForSize(n: number): number {
  if (n <= 1) return 0;
  const EULER_GAMMA = 0.5772156649;
  return 2 * (Math.log(n - 1) + EULER_GAMMA) - (2 * (n - 1)) / n;
}

function pathLength(node: TreeNode, point: FeatureVector, depth: number): number {
  if (node.splitFeature === undefined || !node.left || !node.right) {
    return depth + averagePathLengthForSize(node.size);
  }
  return point[node.splitFeature] < node.splitValue!
    ? pathLength(node.left, point, depth + 1)
    : pathLength(node.right, point, depth + 1);
}

export interface IsolationForest {
  trees: TreeNode[];
  sampleSize: number;
  trainedOnPoints: number;
}

export function fitIsolationForest(
  points: FeatureVector[],
  opts: { numTrees?: number; seedKey?: string } = {}
): IsolationForest {
  const numTrees = opts.numTrees ?? DEFAULT_NUM_TREES;
  const rand = mulberry32(hashSeed(opts.seedKey ?? "ecoclamp"));
  const sampleSize = Math.min(DEFAULT_SUBSAMPLE_SIZE, points.length);
  const maxDepth = Math.ceil(Math.log2(Math.max(2, sampleSize)));

  const trees: TreeNode[] = [];
  for (let t = 0; t < numTrees; t++) {
    const shuffled = points.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    trees.push(buildTree(shuffled.slice(0, sampleSize), 0, maxDepth, rand));
  }

  return { trees, sampleSize, trainedOnPoints: points.length };
}

/**
 * Anomaly score in (0, 1): ~0.5 is a typical path length (normal), values
 * approaching 1 mean the point isolated in very few random splits across
 * the forest (anomalous), values well under 0.5 mean it's deeply embedded
 * among the training data (very normal).
 */
export function isolationScore(forest: IsolationForest, point: FeatureVector): number {
  const c = averagePathLengthForSize(forest.sampleSize);
  if (c === 0) return 0.5;
  const avgPath = forest.trees.reduce((sum, tree) => sum + pathLength(tree, point, 0), 0) / forest.trees.length;
  return Math.pow(2, -avgPath / c);
}
