# DSA Module

The `dsa` module provides data structures and algorithms including stack, queue, heap, binary tree, graph, and utility functions for sorting and searching.

## Import

```mux
import std.dsa

// Or import specific modules:
import std.dsa.stack
import std.dsa.queue
import std.dsa.deque
import std.dsa.heap
import std.dsa.priority_queue
import std.dsa.bintree
import std.dsa.graph
import std.dsa.weighted_graph
import std.dsa.union_find
import std.dsa.trie
import std.dsa.algorithm
```

## Collection Interface

The collection-oriented DSA structures implement the `Collection<T>` interface
(the integer-specialized `UnionFind` is intentionally not a collection):

```mux
import std.dsa.collection.Collection
```

| Method       | Returns   | Description                             |
| ------------ | --------- | --------------------------------------- |
| `len()`      | `int`     | Returns the number of elements          |
| `is_empty()` | `bool`    | Returns true if the collection is empty |
| `to_list()`  | `list<T>` | Returns elements as a list              |

## Stack

A LIFO (last-in, first-out) collection.

```mux
import std.dsa.stack
```

### Stack Methods

| Method           | Returns       | Description                                 |
| ---------------- | ------------- | ------------------------------------------- |
| `Stack<T>.new()` | `Stack<T>`    | Creates an empty stack                      |
| `push(T value)`  | `void`        | Adds an element to the top                  |
| `pop()`          | `optional<T>` | Removes and returns the top element         |
| `peek()`         | `optional<T>` | Returns the top element without removing it |

Also implements `len()`, `is_empty()`, `clear()`, `contains()`, and
`to_list()`.

## Deque

A double-ended queue with explicit operations at either end. The current list
backing keeps the API value-semantic; front insertion/removal is linear.

| Method                                       | Returns       | Description                           |
| -------------------------------------------- | ------------- | ------------------------------------- |
| `Deque<T>.new()`                             | `Deque<T>`    | Creates an empty deque                |
| `Deque<T>.from_list(list<T>)`                | `Deque<T>`    | Creates a deque from an existing list |
| `push_front(T value)` / `push_back(T value)` | `void`        | Adds at either end                    |
| `pop_front()` / `pop_back()`                 | `optional<T>` | Removes and returns an end value      |
| `front()` / `back()`                         | `optional<T>` | Peeks at an end value                 |

## PriorityQueue

A priority queue backed by a binary heap. `PriorityQueue.new()` is a min-queue;
`PriorityQueue.new_max()` creates a max-queue.

| Method                       | Returns            | Description                                 |
| ---------------------------- | ------------------ | ------------------------------------------- |
| `PriorityQueue<T>.new()`     | `PriorityQueue<T>` | Creates an empty min-priority queue         |
| `PriorityQueue<T>.new_max()` | `PriorityQueue<T>` | Creates an empty max-priority queue         |
| `push(T value)`              | `void`             | Adds a value                                |
| `peek()` / `pop()`           | `optional<T>`      | Reads or removes the highest-priority value |

Also implements `len()`, `is_empty()`, `clear()`, `contains()`, and
`to_list()`. The list returned by `to_list()` is the heap's internal level
order, not a sorted view.

## UnionFind

An integer disjoint-set structure with path compression and union by size.
`UnionFind.with_size(count)` creates elements `0` through `count - 1`.

| Method                      | Returns | Description                                   |
| --------------------------- | ------- | --------------------------------------------- |
| `union(int a, int b)`       | `bool`  | Merges components; false if already connected |
| `connected(int a, int b)`   | `bool`  | Checks component membership                   |
| `component_size(int value)` | `int`   | Returns the component size                    |

`find(int value)` returns the representative ID. `to_list()` exposes the
current parent array for diagnostics; it is not a stable component listing.

`value` arguments must be valid element IDs from `0` through `len() - 1`.

## Trie

`Trie` stores Unicode strings by shared prefixes. Insertion is idempotent;
removing a word does not remove other words that share its prefix.

| Method                             | Returns        | Description                           |
| ---------------------------------- | -------------- | ------------------------------------- |
| `insert(string word)`              | `void`         | Adds a word                           |
| `contains(string word)`            | `bool`         | Tests for an exact word               |
| `starts_with(string prefix)`       | `bool`         | Tests whether any word has the prefix |
| `remove(string word)`              | `bool`         | Unmarks an exact word                 |
| `to_list()`                        | `list<string>` | Enumerates words deterministically    |
| `words_with_prefix(string prefix)` | `list<string>` | Enumerates matching words             |

Also implements `len()`, `is_empty()`, and `clear()`.

## Queue

A FIFO (first-in, first-out) collection.

```mux
import std.dsa.queue
```

### Queue Methods

| Method             | Returns       | Description                                   |
| ------------------ | ------------- | --------------------------------------------- |
| `Queue<T>.new()`   | `Queue<T>`    | Creates an empty queue                        |
| `enqueue(T value)` | `void`        | Adds an element to the back                   |
| `dequeue()`        | `optional<T>` | Removes and returns the front element         |
| `peek()`           | `optional<T>` | Returns the front element without removing it |

Also implements `len()`, `is_empty()`, `clear()`, `to_list()`.

## Heap

A min-heap collection where the smallest element is always at the top.

```mux
import std.dsa.heap
```

### Heap Methods

| Method                           | Returns       | Description                                                  |
| -------------------------------- | ------------- | ------------------------------------------------------------ |
| `Heap<T>.new()`                  | `Heap<T>`     | Creates an empty heap                                        |
| `Heap<T>.new_max()`              | `Heap<T>`     | Creates an empty max-heap                                    |
| `Heap<T>.from_list(list<T>)`     | `Heap<T>`     | Builds a min-heap from values                                |
| `Heap<T>.from_list_max(list<T>)` | `Heap<T>`     | Builds a max-heap from values                                |
| `push(T value)`                  | `void`        | Adds an element                                              |
| `pop()`                          | `optional<T>` | Removes and returns the highest-priority element             |
| `peek()`                         | `optional<T>` | Returns the highest-priority element without removing it     |
| `merge(Heap<T> other)`           | `void`        | Adds all values from another heap using this heap's ordering |

Type constraint: `T is Comparable`

Also implements `len()`, `is_empty()`, `clear()`, `contains()`, `to_list()`.

## BinaryTree

An AVL-balanced ordered tree with set semantics (duplicates are ignored). Lookup, insertion, and removal are logarithmic in the number of stored elements.

```mux
import std.dsa.bintree
```

### BinaryTree Methods

| Method                                         | Returns         | Description                                        |
| ---------------------------------------------- | --------------- | -------------------------------------------------- |
| `BinaryTree<T>.new()`                          | `BinaryTree<T>` | Creates an empty tree                              |
| `insert(T value)`                              | `void`          | Adds an element                                    |
| `remove(T value)`                              | `void`          | Removes an element                                 |
| `contains(T value)`                            | `bool`          | Checks if an element exists                        |
| `min()` / `max()`                              | `optional<T>`   | Returns the smallest or largest element            |
| `height()`                                     | `int`           | Returns the tree height in edges (`-1` when empty) |
| `preorder()` / `postorder()` / `level_order()` | `list<T>`       | Returns the corresponding traversal                |

Type constraint: `T is Comparable`

Also implements `len()`, `is_empty()`, and `to_list()` (returns elements in sorted order via inorder traversal). `clear()` is available on `BinaryTree` itself.

## Graph

A graph using set-valued adjacency lists. Each edge is unique: adding the same
edge more than once does not change the graph. `Graph.new()` is directed;
`Graph.new_undirected()` creates a graph that maintains both directions.

```mux
import std.dsa.graph
```

### Graph Methods

| Method                             | Returns             | Description                                                          |
| ---------------------------------- | ------------------- | -------------------------------------------------------------------- |
| `Graph<T>.new()`                   | `Graph<T>`          | Creates an empty directed graph                                      |
| `Graph<T>.new_undirected()`        | `Graph<T>`          | Creates an empty undirected graph                                    |
| `add_vertex(T value)`              | `void`              | Adds a vertex                                                        |
| `add_edge(T from, T to)`           | `void`              | Adds a unique edge (and its reverse for undirected graphs)           |
| `neighbors(T value)`               | `list<T>`           | Returns neighbors of a vertex                                        |
| `has_edge(T from, T to)`           | `bool`              | Tests whether one directed edge exists                               |
| `degree(T value)`                  | `int`               | Returns the number of distinct outgoing edges                        |
| `bfs(T start)`                     | `list<T>`           | Breadth-first search traversal                                       |
| `dfs(T start)`                     | `list<T>`           | Depth-first search traversal                                         |
| `shortest_path(T start, T target)` | `optional<list<T>>` | Returns one shortest unweighted path                                 |
| `topological_sort()`               | `optional<list<T>>` | Returns an insertion-stable topological order, or `none` for a cycle |
| `is_connected()` / `has_cycle()`   | `bool`              | Checks directed reachability or graph cycles                         |
| `remove_edge(T from, T to)`        | `void`              | Removes an edge if present                                           |
| `remove_vertex(T value)`           | `void`              | Removes a vertex and all incident edges                              |

Type constraint: `T is Hashable`

Also implements `len()`, `is_empty()`, `clear()`, `to_list()` (returns vertices in insertion order).

## WeightedGraph

`WeightedGraph<T>` stores one `float` weight per edge. It has the same
set-valued edge semantics as `Graph`: adding an existing edge replaces its
weight. `new_directed()` is the default; `new_undirected()` maintains the
reverse edge with the same weight. `shortest_path` uses Dijkstra's algorithm
and returns `none` when either vertex is unknown, unreachable, or a negative
weight is encountered.

| Method                                                 | Returns             | Description                                      |
| ------------------------------------------------------ | ------------------- | ------------------------------------------------ |
| `WeightedGraph<T>.new_directed()`                      | `WeightedGraph<T>`  | Creates a directed weighted graph                |
| `WeightedGraph<T>.new_undirected()`                    | `WeightedGraph<T>`  | Creates an undirected weighted graph             |
| `add_edge(T from, T to, float weight)`                 | `void`              | Adds or replaces one edge                        |
| `edge_weight(T from, T to)`                            | `optional<float>`   | Reads an edge weight                             |
| `shortest_path(T start, T target)`                     | `optional<list<T>>` | Returns the lowest-cost path                     |
| `has_edge(T from, T to)`                               | `bool`              | Tests whether one directed edge exists           |
| `neighbors(T value)`                                   | `list<T>`           | Returns distinct neighbors                       |
| `remove_edge(T from, T to)` / `remove_vertex(T value)` | `void`              | Removes an edge or vertex and its incident edges |

Also implements `len()`, `is_empty()`, `clear()`, `contains()`, and
`to_list()`. Adding an existing weighted edge is idempotent with respect to
edge membership and replaces that edge's weight.

## Algorithm Functions

```mux
import std.dsa.algorithm
```

### Functions

| Function                            | Signature                                                                                      | Description                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `sort`                              | `<T is Comparable>(list<T> items) returns list<T>`                                             | Stable sorted copy; equal elements retain their input order                        |
| `sort_by`                           | `<T>(list<T> items, func(T, T) returns int cmp) returns list<T>`                               | Stable sorted copy using a comparator                                              |
| `sort_in_place`                     | `<T is Comparable>(list<T> items) returns void`                                                | Stable sort that updates the input list                                            |
| `sort_by_in_place`                  | `<T>(list<T> items, func(T, T) returns int cmp) returns void`                                  | Stable comparator sort that updates the input list                                 |
| `binary_search`                     | `<T is Comparable, E is Collection<T>>(E items, T target) returns optional<int>`               | Searches an already-sorted collection and returns the matching index, or `none`    |
| `binary_search_by`                  | `<T, E is Collection<T>>(E items, T target, func(T, T) returns int cmp) returns optional<int>` | Comparator-based search of an already-sorted collection; never sorts               |
| `lower_bound` / `upper_bound`       | `<T is Comparable, E is Collection<T>>(E items, T target) returns int`                         | Returns the first index not less than, or the first index greater than, the target |
| `lower_bound_by` / `upper_bound_by` | `<T, E is Collection<T>>(E items, T target, func(T, T) returns int cmp) returns int`           | Comparator-based insertion bounds                                                  |
| `partition`                         | `<T>(list<T> items, func(T) returns bool predicate) returns int`                               | Stable in-place partition; returns the first non-matching index                    |
| `find` / `find_index`               | Predicate-based                                                                                | Finds the first matching value or its index (`-1` when absent)                     |
| `reduce`                            | `<T, U, E is Collection<T>>(E items, U initial, func(U, T) returns U combine) returns U`       | Left-to-right reduction with an explicit initial value                             |
| `max_by` / `min_by`                 | Comparator-based                                                                               | Selects an extreme element using a comparator                                      |
| `max`                               | `<T is Comparable, E is Collection<T>>(E collection) returns optional<T>`                      | Returns maximum element                                                            |
| `min`                               | `<T is Comparable, E is Collection<T>>(E collection) returns optional<T>`                      | Returns minimum element                                                            |
| `reverse`                           | `<T, E is Collection<T>>(E collection) returns list<T>`                                        | Returns reversed list                                                              |

## Example

```mux title="dsa_example.mux"
import std.dsa.*
import std.dsa.collection.Collection

func main() returns void {
    // Stack example
    auto s = stack.Stack<int>.new()
    s.push(1)
    s.push(2)
    s.push(3)

    match s.peek() {
        some(v) { print("Stack top: " + v.to_string()) }  // 3
        none { print("Stack top: empty") }
    }

    match s.pop() {
        some(v) { print("Popped: " + v.to_string()) }  // 3
        none {}
    }

    // Queue example
    auto q = queue.Queue<string>.new()
    q.enqueue("first")
    q.enqueue("second")
    q.enqueue("third")

    match q.dequeue() {
        some(v) { print("Dequeued: " + v) }  // first
        none {}
    }

    // Heap example (min-heap)
    auto h = heap.Heap<int>.new()
    h.push(30)
    h.push(10)
    h.push(20)

    match h.pop() {
        some(v) { print("Min: " + v.to_string()) }  // 10
        none {}
    }

    // Algorithm example
    auto numbers = [5, 3, 8, 1, 2]
    auto sorted = algorithm.sort(numbers)
    print("Sorted: " + sorted.to_string())  // [1, 2, 3, 5, 8]

    // Binary search requires the collection to already be sorted, and returns
    // an index into iteration order. A Stack iterates in push order, so pushing
    // 1, 3, 5 gives a sorted, ascending sequence to search.
    auto search = stack.Stack<int>.new()
    search.push(1)
    search.push(3)
    search.push(5)
    match algorithm.binary_search(search, 3) {
        some(idx) { print("Found 3 at index: " + idx.to_string()) }
        none { print("Not found") }
    }
    return
}
```
