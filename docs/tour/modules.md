---
id: modules
title: Modules
description: Organizing your code with modules in Mux
---

import VideoPlaceholder from '@site/src/components/VideoPlaceholder';
import EmbeddedPlayground from '@site/src/components/EmbeddedPlayground';

# Modules

<VideoPlaceholder topic="Modules" />

Modules help organize your code into separate files and namespaces.

## Import Statements

Import a module with a dotted path; its members are then reached through the
last path segment:

<EmbeddedPlayground initialCode={`import std.math

func main() returns void {
    print("Square root: " + math.sqrt(16.0).to_string())
    return
}`} />

## Using Standard Library

<EmbeddedPlayground initialCode={`import std.math
import std.random

func main() returns void {
    print("Pi from math: " + math.pi.to_string())

    random.seed(42)
    print("Random 1-100: " + random.next_range(1, 101).to_string())
    return
}`} />

## Creating Your Own Modules

Organize related code into separate files with the `.mux` extension.

---

Previous: [References](/docs/tour/references) | Next: [Next Steps](/docs/tour/next-steps)