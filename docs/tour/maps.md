---
id: maps
title: Maps
description: Key-value data structures in Mux
---

import VideoPlaceholder from '@site/src/components/VideoPlaceholder';
import EmbeddedPlayground from '@site/src/components/EmbeddedPlayground';

# Maps

<VideoPlaceholder topic="Maps" />

Maps store key-value pairs, allowing fast lookup by key.

## Creating Maps

<EmbeddedPlayground initialCode={`func main() returns void {
    map<string, int> scores = {"Alice": 90, "Bob": 85}
    
    print("Scores: " + scores.to_string())
    return
}`} />

## Empty Maps

An empty map is written `{:}`, not `{}`. Braces on their own are the empty
**set**, so the colon is what tells the two apart. An empty map also needs an
explicit type, since there are no entries to infer the key and value types from.

<EmbeddedPlayground initialCode={`func main() returns void {
    map<string, int> scores = {:}
    set<string> names = {}

    scores["Alice"] = 90
    names.add("Alice")

    print("Scores: " + scores.to_string())
    print("Names: " + names.to_string())
    return
}`} />

Writing `{}` where a map is expected is a compile error that points you at `{:}`.

## Accessing Values

<EmbeddedPlayground initialCode={`func main() returns void {
    map<string, int> scores = {"Alice": 90, "Bob": 85}
    
    print("Alice: " + scores["Alice"].to_string())
    print("Bob: " + scores["Bob"].to_string())
    return
}`} />

## Modifying Maps

<EmbeddedPlayground initialCode={`func main() returns void {
    map<string, int> scores = {"Alice": 90}
    
    scores["Alice"] = 95
    scores.put("Charlie", 88)
    
    print("After changes: " + scores.to_string())
    return
}`} />

## Map Methods

<EmbeddedPlayground initialCode={`func main() returns void {
    map<string, int> scores = {"Alice": 90, "Bob": 85}
    
    print("Keys: " + scores.get_keys().to_string())
    print("Values: " + scores.get_values().to_string())
    print("Size: " + scores.size().to_string())
    print("Has Alice: " + scores.contains("Alice").to_string())
    return
}`} />

---

Previous: [Lists](/docs/tour/lists) | Next: [Sets](/docs/tour/sets)