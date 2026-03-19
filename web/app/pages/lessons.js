/** Lessons page + individual lesson renderer */

const LESSONS = [
  {
    id: 'what-is-ml',
    icon: '🧠',
    title: 'What is Machine Learning?',
    difficulty: 'beginner',
    duration: '15 min',
    desc: 'A gentle introduction to how computers learn from data.',
    body: `
      <div class="callout">
        <strong>Learning objectives:</strong>
        <ul style="margin:6px 0 0 0">
          <li>Explain the difference between rule-based programming and machine learning.</li>
          <li>Name the three main types of machine learning.</li>
          <li>Describe the roles of <em>training data</em>, a <em>model</em>, and <em>inference</em>.</li>
          <li>Understand where JumpNet fits into the ML picture.</li>
        </ul>
      </div>

      <h3>Traditional Programming vs. Machine Learning</h3>
      <p>In <strong>traditional programming</strong> a developer writes every rule by hand.
      Want to detect a red bead? You might write:</p>

      <pre><code>if red_channel > 150 and green_channel < 80 and blue_channel < 80:
    return "red bead"</code></pre>

      <p>That might work under one lamp, but change the lighting and the rule breaks.
      Writing rules for every edge case quickly becomes impossible.</p>

      <p><strong>Machine learning</strong> flips this around. Instead of rules → answers,
      you give the computer <em>examples → answers</em> and let it discover the rules itself:</p>

      <pre><code>               Traditional programming
  Rules ──────┐
              ├──► Computer ──► Output
  Data  ──────┘

               Machine learning
  Data   ─────┐
              ├──► Computer ──► Rules (the model)
  Answers ────┘
      Then later:
  New data ───► Model ──► Predictions</code></pre>

      <p>The computer finds patterns in the examples that are too complex or too numerous
      for a human to hand-code.</p>

      <div class="callout tip">
        <strong>Analogy — learning to recognise a dog:</strong> Nobody gave you a rulebook.
        You just saw lots of dogs (and non-dogs) over many years until your brain built
        a mental model. Machine learning works the same way, just with maths instead of neurons.
      </div>

      <h3>The Three Types of Machine Learning</h3>

      <p>All ML algorithms fall into one of three broad categories:</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <thead>
          <tr style="background:var(--bg-card);text-align:left">
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Type</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">What you provide</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Example use case</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)"><strong>Supervised</strong></td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Labelled examples (input + correct answer)</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Image classification, spam detection</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)"><strong>Unsupervised</strong></td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Unlabelled data (no answers given)</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Grouping customers by behaviour</td>
          </tr>
          <tr>
            <td style="padding:8px 12px"><strong>Reinforcement</strong></td>
            <td style="padding:8px 12px">Rewards and penalties for actions</td>
            <td style="padding:8px 12px">Teaching a robot to walk, game AI</td>
          </tr>
        </tbody>
      </table>

      <p>JumpNet uses <strong>supervised learning</strong> — every image in your dataset
      must be labelled with the correct class name before training can begin.</p>

      <h3>Key Vocabulary</h3>

      <dl style="display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;font-size:14px;margin:12px 0">
        <dt style="font-weight:600;padding:4px 0">Dataset</dt>
        <dd style="margin:0;padding:4px 0;border-bottom:1px solid var(--border)">A collection of labelled examples used to train a model.</dd>
        <dt style="font-weight:600;padding:4px 0">Label</dt>
        <dd style="margin:0;padding:4px 0;border-bottom:1px solid var(--border)">The correct answer for one example — e.g. <code>"red"</code>, <code>"blue"</code>, <code>"rock"</code>.</dd>
        <dt style="font-weight:600;padding:4px 0">Feature</dt>
        <dd style="margin:0;padding:4px 0;border-bottom:1px solid var(--border)">A measurable property of the input. For images, pixel colours are the raw features.</dd>
        <dt style="font-weight:600;padding:4px 0">Model</dt>
        <dd style="margin:0;padding:4px 0;border-bottom:1px solid var(--border)">The mathematical function produced by training. It maps inputs to predictions.</dd>
        <dt style="font-weight:600;padding:4px 0">Training</dt>
        <dd style="margin:0;padding:4px 0;border-bottom:1px solid var(--border)">The process of adjusting a model's internal numbers (weights) until its predictions match the labels.</dd>
        <dt style="font-weight:600;padding:4px 0">Inference</dt>
        <dd style="margin:0;padding:4px 0;border-bottom:1px solid var(--border)">Using a trained model to classify new, unseen data in real time.</dd>
        <dt style="font-weight:600;padding:4px 0">Epoch</dt>
        <dd style="margin:0;padding:4px 0;border-bottom:1px solid var(--border)">One full pass through the entire training dataset. Training usually runs for 10–50 epochs.</dd>
        <dt style="font-weight:600;padding:4px 0">Accuracy</dt>
        <dd style="margin:0;padding:4px 0">The percentage of predictions the model gets right on a held-out test set.</dd>
      </dl>

      <h3>How a Model Learns — The Big Picture</h3>

      <p>During training the model sees an image and makes a guess. It compares
      the guess to the true label using a <em>loss function</em> — a number that measures
      how wrong the prediction was. Then an algorithm called <strong>gradient descent</strong>
      nudges each weight slightly in the direction that would reduce the loss. After
      thousands of examples and many epochs, the weights settle into values that
      produce good predictions.</p>

      <pre><code>for each epoch:
    for each image in training set:
        prediction  = model(image)           # forward pass
        loss        = compare(prediction, true_label)
        update model weights to reduce loss  # backward pass (backpropagation)

    val_accuracy = evaluate on held-out images
    print(f"Epoch {epoch}: loss={loss:.3f}, val_acc={val_accuracy:.1%}")</code></pre>

      <div class="callout tip">
        <strong>You don't need to implement any of this yourself.</strong>
        JumpNet's training endpoint handles all of it — you just supply images and labels.
      </div>

      <h3>What JumpNet Does</h3>

      <p>JumpNet wraps a compact neural network (<strong>MobileNetV2</strong>) that runs
      efficiently even on low-power hardware. Here is where each step happens in a
      typical classroom session:</p>

      <ol>
        <li><strong>Collect data</strong> — you capture images with a camera and upload them
            to JumpNet via the Dataset page or a microcontroller CEP client.</li>
        <li><strong>Train</strong> — the instructor triggers training; the server fine-tunes
            MobileNetV2 on your labelled images (this can take a few minutes).</li>
        <li><strong>Infer</strong> — your trained model bundle is saved and the Classify page (or
            your Arduino/MicroPython script) sends new images to <code>POST /infer</code>
            to get predictions in real time.</li>
      </ol>

      <h3>Check Your Understanding</h3>
      <ol>
        <li>What is the key difference between traditional programming and machine learning?</li>
        <li>Name the three types of ML. Which one does JumpNet use?</li>
        <li>What is a <em>label</em>? Give an example from a project you could build.</li>
        <li>During training, what does <em>loss</em> measure?</li>
        <li>What is the difference between <em>training</em> and <em>inference</em>?</li>
      </ol>

      <div class="callout">
        <strong>Next up:</strong> Read <em>Image Classification</em> to understand how
        the network actually looks at an image and what a convolutional layer does.
      </div>
    `,
  },
  {
    id: 'image-class',
    icon: '🖼️',
    title: 'Image Classification',
    difficulty: 'beginner',
    duration: '20 min',
    desc: 'How models learn to tell objects apart using pixels.',
    body: `
      <div class="callout">
        <strong>Learning objectives:</strong>
        <ul style="margin:6px 0 0 0">
          <li>Explain how a digital image is represented as numbers.</li>
          <li>Describe what a Convolutional Neural Network (CNN) does at each stage.</li>
          <li>Understand why transfer learning works and why it matters for small datasets.</li>
          <li>Know what MobileNetV2 is and why JumpNet uses it.</li>
        </ul>
      </div>

      <h3>Images Are Just Numbers</h3>
      <p>A digital image is a rectangular grid of <strong>pixels</strong>. Each pixel
      stores three numbers — one for Red, one for Green, one for Blue — each ranging
      from 0 (none) to 255 (full). A 224 × 224 image therefore contains
      224 × 224 × 3 = <strong>150,528 numbers</strong>.</p>

      <pre><code>Pixel at (row=0, col=0):  R=210, G=180, B=140  → warm beige
Pixel at (row=0, col=1):  R= 20, G= 20, B= 20  → near-black
...</code></pre>

      <p>Feeding all 150,528 raw numbers into a simple formula to decide "red bead or blue bead"
would work poorly — the slightest change in lighting shifts every number, even though
the object is the same. CNNs solve this by learning <em>features</em> that are robust
to small variations.</p>

      <h3>Convolutional Neural Networks (CNNs)</h3>
      <p>A CNN processes an image in a series of <strong>layers</strong>. Think of each
      layer as a set of tiny filters sliding across the image looking for something specific.</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <thead>
          <tr style="background:var(--bg-card);text-align:left">
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Layer depth</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">What it detects</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Early</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Edges, colour gradients</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">A horizontal or vertical line</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Middle</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Textures, simple shapes</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">A curved edge, a grid pattern</td>
          </tr>
          <tr>
            <td style="padding:8px 12px">Deep</td>
            <td style="padding:8px 12px">Complex objects, parts</td>
            <td style="padding:8px 12px">A round bead, a leaf shape, a hand</td>
          </tr>
        </tbody>
      </table>

      <p>At the very end a <strong>classification head</strong> — a small fully-connected
      network — looks at all the deep features and outputs one probability per class.
      The class with the highest probability is the prediction.</p>

      <pre><code>Input image (224×224×3)
    └─► Conv layers  →  edges, textures, shapes
            └─► Pooling  →  condense spatial info
                    └─► Classification head  →  [0.02, 0.95, 0.03]  (class probabilities)
                                                         ↑
                                                   "red bead" wins</code></pre>

      <div class="callout tip">
        <strong>Why 224 × 224?</strong> Most standard CNNs were designed around this
        input size because it balances detail and compute cost. JumpNet resizes and
        crops your images to 224 × 224 automatically before passing them to the network.
      </div>

      <h3>The Convolution Operation</h3>
      <p>A <em>convolution</em> applies a small matrix called a <strong>kernel</strong>
      (typically 3 × 3 pixels) to every position in the image. The kernel slides
      across, multiplying its values by the overlapping pixels and summing the result.
      Each kernel is a learnable filter — during training the network discovers which
      kernels are most useful for telling classes apart.</p>

      <pre><code>Image patch:    Kernel (edge detector):    Result:
  10  20  30      -1  0  1               (-1×10)+(0×20)+(1×30)
  10  20  30   ×  -1  0  1           =       ... (one output pixel)
  10  20  30      -1  0  1</code></pre>

      <p>Hundreds of different kernels run in parallel, each producing a separate
      <em>feature map</em>. Stacking many convolutional layers multiplies expressive power.</p>

      <h3>MobileNetV2 — Designed for the Edge</h3>
      <p>Training a CNN from scratch on ImageNet (1.2 million images, 1000 classes)
      takes days on powerful GPUs. JumpNet uses <strong>MobileNetV2</strong>, a
      CNN architecture developed by Google specifically for constrained hardware.</p>

      <p>Key design choices that make it lightweight:</p>
      <ul>
        <li><strong>Depthwise separable convolutions</strong> — split a standard convolution
            into two cheaper steps, cutting computation by ~8–9×.</li>
        <li><strong>Inverted residuals</strong> — expand features in a small bottleneck,
            process them, then compress back down. Reduces memory.</li>
        <li><strong>Linear bottlenecks</strong> — prevent information loss when compressing.</li>
      </ul>

      <p>The result: MobileNetV2 achieves ~72% top-1 accuracy on ImageNet using only
      3.4 million parameters and 300 million multiply-adds per image — fast enough to
      run on a Raspberry Pi.</p>

      <h3>Transfer Learning</h3>
      <p>Even MobileNetV2 would need thousands of images per class if trained from zero.
      <strong>Transfer learning</strong> sidesteps this by reusing a model that was already
      trained on a huge dataset.</p>

      <pre><code>Phase 1 — Pre-training (done once by Google, not by you):
  MobileNetV2 trains on ImageNet: 1.2 M images, 1000 classes
  → learns general visual features: edges, textures, shapes, objects

Phase 2 — Fine-tuning (done by JumpNet's /train endpoint):
  Freeze the pre-trained backbone (keep all those useful features)
  Replace only the final classification head (new layer for your classes)
  Train on YOUR 20–50 images per class for a few minutes
  → model learns to distinguish your specific labels</code></pre>

      <p>This works because the features learned on ImageNet — edges, curves,
      textures — are universally useful. The only thing that needs relearning is
      <em>which combination of features means "red bead"</em> vs. <em>"blue bead"</em>.</p>

      <div class="callout tip">
        <strong>Rule of thumb:</strong> Aim for at least 20–50 images per class.
        More is better, but transfer learning means 20 images can already be enough
        for visually distinct classes. Vary lighting, angle, and distance as much
        as possible when capturing.
      </div>

      <h3>Softmax and Class Probabilities</h3>
      <p>The classification head ends with a <strong>softmax</strong> function that
      converts raw scores (called <em>logits</em>) into probabilities that sum to 1.0.</p>

      <pre><code>Raw logits:     [2.1,  5.8,  0.3]   (one per class, arbitrary scale)
After softmax:  [0.03, 0.95, 0.02]  (probabilities, always sum to 1)
                        ↑
                  "red bead" — 95% confident</code></pre>

      <p>JumpNet returns this top probability as <code>confidenceScore</code>.
      You will learn more about interpreting it in the
      <em>Understanding Confidence Scores</em> lesson.</p>

      <h3>Check Your Understanding</h3>
      <ol>
        <li>How many numbers make up a 224 × 224 colour image?</li>
        <li>What does an early convolutional layer typically detect? What about a deep layer?</li>
        <li>What is a <em>kernel</em> in the context of a CNN?</li>
        <li>Why is MobileNetV2 faster than a typical full-size network?</li>
        <li>What is kept frozen during transfer learning, and what is replaced?</li>
        <li>If softmax outputs <code>[0.01, 0.02, 0.97]</code> for classes
            [rock, paper, scissors], what is the prediction and confidence?</li>
      </ol>

      <div class="callout">
        <strong>Next up:</strong> Read <em>The Training Workflow</em> to see the full
        collect → train → evaluate → deploy cycle in JumpNet.
      </div>
    `,
  },
  {
    id: 'training-workflow',
    icon: '🔄',
    title: 'The Training Workflow',
    difficulty: 'beginner',
    duration: '18 min',
    desc: 'Step-by-step: collect data, train, evaluate, and deploy.',
    body: `
      <div class="callout">
        <strong>Learning objectives:</strong>
        <ul style="margin:6px 0 0 0">
          <li>Walk through the four phases of a JumpNet ML project end-to-end.</li>
          <li>Know exactly which API endpoints are used at each phase.</li>
          <li>Understand what <em>epochs</em>, <em>loss</em>, and <em>val_accuracy</em> mean in training logs.</li>
          <li>Diagnose and fix the most common training problems.</li>
        </ul>
      </div>

      <p>Every JumpNet project follows the same four-phase cycle. You will repeat
      this cycle many times — each iteration produces a better model.</p>

      <pre><code>┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. Collect │───►│  2. Train   │───►│ 3. Evaluate │───►│  4. Deploy  │
│             │    │             │    │             │    │             │
│ capture +   │    │ POST /train │    │ check logs  │    │ POST /infer │
│ label images│    │ watch logs  │    │ test live   │    │ in your app │
└─────────────┘    └─────────────┘    └──────┬──────┘    └─────────────┘
                                             │
                          accuracy too low? ─┘ loop back to Collect</code></pre>

      <h3>Phase 1 — Collect Data</h3>
      <p>Good data is the single most important factor in model quality.
      Before capturing images, answer these questions:</p>
      <ul>
        <li><strong>What are the classes?</strong> Each class becomes one label. Keep them
            visually distinct — the camera needs to be able to tell them apart too.</li>
        <li><strong>Where will the model run?</strong> Capture images in the same environment
            (same camera height, similar lighting) as real use.</li>
        <li><strong>How many?</strong> Aim for 30–100 images per class. More is better,
            but variety beats volume — 50 diverse images outperform 200 identical ones.</li>
      </ul>

      <p>Upload each image via the Dataset page or the API:</p>
      <pre><code>POST /dataset/upload          (multipart/form-data)
  dataset  = "beads"
  label    = "red"
  file     = &lt;image file&gt;

Response:
{ "saved": "beads/red/img_0042.jpg", "total": 43 }</code></pre>

      <div class="callout tip">
        <strong>Diversity checklist:</strong> different distances ✓  different angles ✓
        different backgrounds ✓  different lighting ✓  object partially occluded ✓
      </div>

      <h3>Phase 2 — Train</h3>
      <p>Once you have enough labelled images, start a training job:</p>

      <pre><code>POST /train
{
  "datasetId": "beads",
  "epochs":    20,
  "batchSize": 16,
  "imageSize": 224
}

Response (202 Accepted):
{ "jobId": "train_8f3c", "status": "queued" }</code></pre>

      <p>The server fine-tunes MobileNetV2 on your images. Training runs
      asynchronously — poll for progress:</p>

      <pre><code>GET /train/train_8f3c/logs

[
  { "epoch": 1, "loss": 1.423, "val_loss": 1.198, "val_accuracy": 0.61 },
  { "epoch": 2, "loss": 0.891, "val_loss": 0.742, "val_accuracy": 0.78 },
  ...
  { "epoch": 20, "loss": 0.124, "val_loss": 0.201, "val_accuracy": 0.94 }
]</code></pre>

      <h4>Reading the logs</h4>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <thead>
          <tr style="background:var(--bg-card);text-align:left">
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Field</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Meaning</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Good sign</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>loss</code></td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Error on the <em>training</em> images this epoch</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Decreasing each epoch</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>val_loss</code></td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Error on the held-out validation images</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Decreasing, close to <code>loss</code></td>
          </tr>
          <tr>
            <td style="padding:8px 12px"><code>val_accuracy</code></td>
            <td style="padding:8px 12px">% of validation images predicted correctly</td>
            <td style="padding:8px 12px">Increasing, ideally above 0.90</td>
          </tr>
        </tbody>
      </table>

      <div class="callout tip">
        <strong>What is an epoch?</strong> One complete pass through all your training
        images. Each epoch slightly improves the model. Too few epochs → underfitting
        (model hasn't learned enough). Too many → overfitting (model memorises training
        images but fails on new ones). Watch <code>val_accuracy</code>: if it stops
        improving for several epochs, training is done.
      </div>

      <h3>Phase 3 — Evaluate</h3>
      <p>Once training finishes, check the final job status for a summary:</p>

      <pre><code>GET /train/train_8f3c

{
  "status":      "complete",
  "bundleId":    "beads_v1",
  "val_accuracy": 0.94,
  "epochs":      20,
  "elapsedMs":   47200
}</code></pre>

      <p>Then test the model on images it has <em>never seen</em> — ideally captured
      in a fresh session. Open the <strong>Classify</strong> page, select
      <code>beads_v1</code>, and show it objects one by one. Note:</p>
      <ul>
        <li>Which classes does it confuse?</li>
        <li>Does accuracy drop under different lighting?</li>
        <li>Are confidence scores consistently high (above 0.85) for correct predictions?</li>
      </ul>

      <h3>Phase 4 — Deploy</h3>
      <p>A trained bundle is immediately usable. Send an image to <code>POST /infer</code>
      and specify the bundle:</p>

      <pre><code>POST /infer
{ "bundleId": "beads_v1", "image": "&lt;base64 jpeg&gt;" }

Response:
{
  "bundleId":       "beads_v1",
  "output":         "red",
  "confidenceScore": 0.97,
  "elapsedMs":      34
}</code></pre>

      <p>Your microcontroller, Python script, or web page can call this endpoint
      in a loop to classify objects in real time.</p>

      <h3>Common Problems and Fixes</h3>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <thead>
          <tr style="background:var(--bg-card);text-align:left">
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Symptom</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Likely cause</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Fix</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>val_accuracy</code> stuck below 0.60</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Too few images or classes look too similar</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Add more images; choose more distinct classes</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">High train accuracy, low val accuracy</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Overfitting — model memorised training data</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Add more training images; reduce epochs</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Works in training, fails live</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Training images don't match real conditions</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Recapture images in exact deployment conditions</td>
          </tr>
          <tr>
            <td style="padding:8px 12px">Low confidence on all predictions</td>
            <td style="padding:8px 12px">Labels are ambiguous or images are blurry</td>
            <td style="padding:8px 12px">Review dataset; delete bad images; retrain</td>
          </tr>
        </tbody>
      </table>

      <div class="callout warn">
        <strong>Most common mistake:</strong> Capturing all images in a single session
        under identical conditions. The model then fails as soon as anything changes
        (time of day, lamp angle, background object). Always introduce variation
        <em>while collecting</em> — it is far easier than fixing a bad model after training.
      </div>

      <h3>Check Your Understanding</h3>
      <ol>
        <li>List the four phases of the JumpNet training workflow in order.</li>
        <li>Which endpoint do you call to start training? What does a 202 response mean?</li>
        <li>What is the difference between <code>loss</code> and <code>val_loss</code>?</li>
        <li>Your model reaches 0.99 training accuracy but only 0.55 validation accuracy.
            What is this called and what should you do?</li>
        <li>After training is complete, which endpoint do you call to classify a new image?</li>
        <li>Name two ways to improve a model that performs poorly in live testing.</li>
      </ol>

      <div class="callout">
        <strong>Next up:</strong> Read <em>Datasets and Labels</em> to learn how to
        structure your data collection for the best possible model.
      </div>
    `,
  },
  {
    id: 'datasets-labels',
    icon: '🏷️',
    title: 'Datasets and Labels',
    difficulty: 'beginner',
    duration: '16 min',
    desc: 'Why good labelling is the foundation of a good model.',
    body: `
      <div class="callout">
        <strong>Learning objectives:</strong>
        <ul style="margin:6px 0 0 0">
          <li>Explain what a dataset is and how JumpNet stores one.</li>
          <li>Apply the rules for choosing clear, usable labels.</li>
          <li>Understand class balance and why it matters.</li>
          <li>Describe how the train/validation split works and why it's needed.</li>
          <li>Know how to review, fix, and delete bad images using the Dataset page.</li>
        </ul>
      </div>

      <p>There is a saying in machine learning: <em>"Garbage in, garbage out."</em>
      No amount of clever training can fix a poorly collected dataset. This lesson
      explains how to build a dataset that gives your model the best possible chance.</p>

      <h3>What Is a Dataset?</h3>
      <p>In JumpNet, a <strong>dataset</strong> is a named collection of images
      organised by label. On disk it looks like this:</p>

      <pre><code>datasets/
└── beads/
    ├── red/
    │   ├── img_0001.jpg
    │   ├── img_0002.jpg
    │   └── ...  (e.g. 45 images)
    ├── blue/
    │   └── ...  (e.g. 42 images)
    └── green/
        └── ...  (e.g. 48 images)</code></pre>

      <p>Each subfolder name is a <strong>label</strong>. Every image inside
      belongs exclusively to that label. You can view this structure on the
      <strong>Dataset</strong> page.</p>

      <h3>Choosing Good Labels</h3>
      <p>Labels must obey two rules:</p>

      <dl style="display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;font-size:14px;margin:12px 0">
        <dt style="font-weight:600;padding:6px 0">Mutually exclusive</dt>
        <dd style="margin:0;padding:6px 0;border-bottom:1px solid var(--border)">
          Each image belongs to <em>exactly one</em> label. An image of a red bead
          should not also be labelled blue, even if there is a blue bead in the background.
        </dd>
        <dt style="font-weight:600;padding:6px 0">Exhaustive</dt>
        <dd style="margin:0;padding:6px 0">
          Every object the model will ever encounter at inference time must have a label.
          If you forget to include "empty hand" as a class, any shot without a bead may
          be confidently mis-classified as the closest-looking class.
        </dd>
      </dl>

      <p>Beyond correctness, labels should also be <strong>visually distinct</strong>.
      Ask yourself: "Can I tell these apart by looking at a blurry thumbnail?"
      If a human struggles, the model will too.</p>

      <div class="callout tip">
        <strong>Good label set:</strong> red, blue, green, empty &nbsp;|&nbsp;
        <strong>Problematic:</strong> light-red, dark-red, medium-red
        (too similar — the camera may not distinguish them under changing light).
      </div>

      <h3>How Many Images Do You Need?</h3>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <thead>
          <tr style="background:var(--bg-card);text-align:left">
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Images per class</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Expected outcome</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">&lt; 15</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Likely to underfit — model sees too little variety</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">20 – 50</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Good starting point with transfer learning</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">50 – 150</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Solid results for most classroom projects</td>
          </tr>
          <tr>
            <td style="padding:8px 12px">150 +</td>
            <td style="padding:8px 12px">Diminishing returns unless images are very diverse</td>
          </tr>
        </tbody>
      </table>

      <p>Variety matters more than raw count. 30 images taken from many angles,
      distances, and lighting conditions will outperform 100 identical shots under
      one lamp.</p>

      <h3>Class Balance</h3>
      <p>Try to collect roughly equal numbers of images per class.
      Imagine training on 200 red images and only 5 blue images.
      The model quickly learns that <em>guessing "red" is almost always correct</em>
      and never bothers learning what blue looks like. This is called
      <strong>class imbalance</strong>.</p>

      <pre><code>Imbalanced dataset:         Balanced dataset:
  red:   200 images ████████████████    red:   50 images ████
  blue:    5 images ▌                   blue:  48 images ███▊
  green:  10 images █                   green: 52 images ████▏</code></pre>

      <p>JumpNet does not automatically correct for imbalance, so it is your
      responsibility to collect roughly equal class sizes. Check the Dataset
      page to see per-class counts at a glance.</p>

      <h3>The Train / Validation Split</h3>
      <p>Before training begins, JumpNet <strong>automatically</strong> splits your
      images into two groups:</p>

      <ul>
        <li><strong>Training set (~80%)</strong> — the images the model actually learns from.</li>
        <li><strong>Validation set (~20%)</strong> — images held back and never seen during training.
            Used only to measure how well the model generalises.</li>
      </ul>

      <pre><code>Your 50 red images
├── 40 go to training   (the model adjusts its weights on these)
└── 10 go to validation (the model is tested on these — blind)</code></pre>

      <p>The split is done <em>per class</em>, so balance is preserved.
      The <code>val_accuracy</code> you see in training logs is always measured
      on the validation set — it is a trustworthy estimate of real-world performance.</p>

      <div class="callout tip">
        <strong>Never manually move images between train and validation.</strong>
        If you train on validation images you are "peeking at the answers" and
        <code>val_accuracy</code> will be misleadingly high.
      </div>

      <h3>Capturing Quality Images</h3>
      <p>The following checklist applies when using a USB camera or phone with the
      Dataset page:</p>

      <ul>
        <li>✅ Fill the frame — the object should occupy most of the image.</li>
        <li>✅ Vary the angle: top-down, 45°, side-on.</li>
        <li>✅ Vary the distance: close, medium, far.</li>
        <li>✅ Vary the lighting: overhead, desk lamp, natural light, dim.</li>
        <li>✅ Vary the background: plain, cluttered, different surfaces.</li>
        <li>❌ Avoid motion blur — hold objects still.</li>
        <li>❌ Avoid including other labelled objects in the same frame.</li>
      </ul>

      <h3>Managing Your Dataset</h3>
      <p>The <strong>Dataset</strong> page lets you:</p>
      <ul>
        <li>Browse images by label — spot and delete blurry or mislabelled shots.</li>
        <li>See per-class counts — catch imbalance early.</li>
        <li>Delete individual images via the UI or the API:</li>
      </ul>

      <pre><code>DELETE /dataset/beads/red/img_0012.jpg
→ 204 No Content</code></pre>

      <p>It is worth doing a quick review pass before every training run.
      A single badly-lit or mislabelled image rarely ruins a model, but a dozen
      of them will.</p>

      <h3>Check Your Understanding</h3>
      <ol>
        <li>What does "mutually exclusive" mean for labels? Give an example of a violation.</li>
        <li>What does "exhaustive" mean for labels? Why does missing a class cause problems at inference time?</li>
        <li>You have 180 images for class A and 20 for class B. What problem will this cause, and how do you fix it?</li>
        <li>What is the validation set used for? Why must the model never train on it?</li>
        <li>A student captures all images in a single 5-minute session on a white desk.
            What two improvements would you suggest?</li>
        <li>Which API endpoint removes a single mislabelled image?</li>
      </ol>

      <div class="callout">
        <strong>Next up:</strong> Read <em>Understanding Confidence Scores</em>
        to learn what the model's output number actually means and when to trust it.
      </div>
    `,
  },
  {
    id: 'confidence-scores',
    icon: '📊',
    title: 'Understanding Confidence Scores',
    difficulty: 'intermediate',
    duration: '18 min',
    desc: 'What does 0.97 actually mean? When should you trust the model?',
    body: `
      <div class="callout">
        <strong>Learning objectives:</strong>
        <ul style="margin:6px 0 0 0">
          <li>Explain what a softmax confidence score is and what it measures.</li>
          <li>Interpret a full probability distribution — not just the top score.</li>
          <li>Identify the four situations where a high score can still be wrong.</li>
          <li>Choose an appropriate confidence threshold for a given application.</li>
          <li>Write code that acts on confidence scores in Python and MicroPython.</li>
        </ul>
      </div>

      <h3>Where the Number Comes From</h3>
      <p>Recall from the <em>Image Classification</em> lesson that the final layer
      of MobileNetV2 is a <strong>softmax</strong> function. It takes raw scores
      (logits) for every class and converts them into probabilities that must
      sum to exactly 1.0.</p>

      <pre><code>Raw logits (arbitrary scale):    [ 0.8,  5.3,  1.1,  0.2 ]
                                   red   blue  green empty

After softmax:                   [ 0.03, 0.93, 0.04, 0.01 ]
                                       ↑
                           confidenceScore = 0.93, output = "blue"</code></pre>

      <p>JumpNet picks the class with the highest probability and returns it as
      <code>output</code>, alongside that probability as <code>confidenceScore</code>.</p>

      <pre><code>POST /infer  →  {
  "output":          "blue",
  "confidenceScore": 0.93,
  "bundleId":        "beads_v1",
  "elapsedMs":       31
}</code></pre>

      <h3>Reading the Full Distribution</h3>
      <p>The single <code>confidenceScore</code> tells you how sure the model is
      about its <em>top</em> pick — but looking at the full distribution is more
      informative:</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <thead>
          <tr style="background:var(--bg-card);text-align:left">
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Distribution</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Meaning</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>[0.96, 0.02, 0.01, 0.01]</code></td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Strongly peaked — model is certain</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">✅ Accept</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>[0.51, 0.47, 0.01, 0.01]</code></td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">Two classes nearly tied — genuinely uncertain</td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border)">⚠️ Retry or reject</td>
          </tr>
          <tr>
            <td style="padding:8px 12px"><code>[0.27, 0.25, 0.25, 0.23]</code></td>
            <td style="padding:8px 12px">Flat — model has no idea</td>
            <td style="padding:8px 12px">❌ Reject, check input</td>
          </tr>
        </tbody>
      </table>

      <h3>When High Confidence Can Still Be Wrong</h3>

      <p>Softmax probabilities are <em>relative</em>, not absolute. A model can be
      confidently wrong in four common situations:</p>

      <ol>
        <li>
          <strong>Out-of-distribution input</strong> — the image shows something the
          model was never trained on (e.g. an orange bead when only red/blue/green exist).
          Softmax must assign the probability mass somewhere, so it confidently picks
          the most similar class.
          <pre><code>Orange bead → model outputs "red" with 0.91 confidence
  (it has no "orange" class — red was the closest thing it knows)</code></pre>
        </li>
        <li>
          <strong>Poor image quality</strong> — motion blur, extreme over/underexposure,
          or a very different camera angle can produce a nonsensical feature map that the
          model still forces into a high-confidence answer.
        </li>
        <li>
          <strong>Dataset leakage</strong> — if training and validation images accidentally
          contain very similar shots (e.g. from the same 5-second video clip), the model
          appears accurate during training but fails in real use.
        </li>
        <li>
          <strong>Adversarial proximity</strong> — two classes that look very similar
          (e.g. a red bead vs. a dark-orange bead) may flip between high-confidence
          predictions based on tiny changes in lighting.
        </li>
      </ol>

      <div class="callout tip">
        <strong>Rule of thumb:</strong> High confidence is a <em>necessary</em> condition
        for a good prediction, but not a <em>sufficient</em> one. Always validate your
        model on genuinely new images before deploying it.
      </div>

      <h3>Setting a Confidence Threshold</h3>
      <p>In any real application you should decide in advance what to do when the model
      is uncertain. Two common strategies:</p>

      <dl style="display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;font-size:14px;margin:12px 0">
        <dt style="font-weight:600;padding:6px 0">Hard threshold</dt>
        <dd style="margin:0;padding:6px 0;border-bottom:1px solid var(--border)">
          Accept predictions above a fixed value (e.g. 0.85); reject and ask for a retry below it.
          Simple and easy to explain.
        </dd>
        <dt style="font-weight:600;padding:6px 0">Tiered threshold</dt>
        <dd style="margin:0;padding:6px 0">
          &ge;0.90 → act automatically &nbsp;|&nbsp;
          0.70–0.89 → flag for human review &nbsp;|&nbsp;
          &lt;0.70 → reject. Better for higher-stakes decisions.
        </dd>
      </dl>

      <p>The right threshold depends on the <strong>cost of a wrong answer</strong>
      in your project. Sorting coloured beads on a conveyor? You can afford to be
      aggressive (threshold 0.70). Diagnosing a defect in a safety component?
      Be conservative (threshold 0.95+).</p>

      <h3>Using Confidence Scores in Code</h3>

      <p><strong>Python:</strong></p>
      <pre><code>import requests, base64

with open("photo.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

result = requests.post("http://localhost:4080/infer", json={
    "bundleId": "beads_v1",
    "image": b64
}).json()

THRESHOLD = 0.85

if result["confidenceScore"] >= THRESHOLD:
    print(f"Classified as: {result['output']}  ({result['confidenceScore']:.0%})")
else:
    print(f"Uncertain ({result['confidenceScore']:.0%}) — please retry")</code></pre>

      <p><strong>MicroPython (ESP32 / Pico W):</strong></p>
      <pre><code>import ujson, urequests  # CEP client handles image capture

result = ujson.loads(urequests.post(
    "http://jumpnet.local:4080/infer",
    json={"bundleId": "beads_v1", "image": capture_b64()}
).text)

if result["confidenceScore"] >= 0.85:
    sort_bead(result["output"])   # trigger servo/LED
else:
    signal_retry()                # flash warning LED</code></pre>

      <h3>Calibration: Is 0.90 Really 90% Accurate?</h3>
      <p>A perfectly <strong>calibrated</strong> model would be correct exactly 90%
      of the time when it says 0.90. In practice, neural networks trained with
      transfer learning on small datasets tend to be <em>overconfident</em> —
      they may say 0.90 but only be right 75% of the time.</p>
      <p>This is another reason to test on genuinely new images and not to treat
      the number as an exact probability. Use it as a relative signal:
      higher is better, but always validate empirically.</p>

      <h3>Check Your Understanding</h3>
      <ol>
        <li>What function produces the <code>confidenceScore</code>, and what constraint does it impose on all class probabilities?</li>
        <li>The model returns <code>[0.52, 0.46, 0.01, 0.01]</code>. Should you accept this prediction? Why or why not?</li>
        <li>You show the model a yellow bead, but your dataset only has red/blue/green. What might happen to the confidence score?</li>
        <li>Name two real-world factors (not related to the dataset) that can produce a wrong high-confidence prediction.</li>
        <li>Your bead sorter needs very few errors. Would you set the threshold at 0.65 or 0.92? Explain.</li>
        <li>What does it mean for a model to be "overconfident"?</li>
      </ol>

      <div class="callout">
        <strong>Next up:</strong> Read <em>CEP: Capability Exchange Protocol</em>
        to learn how microcontrollers communicate with JumpNet over the network.
      </div>
    `,
  },
  {
    id: 'cep-protocol',
    icon: '📡',
    title: 'CEP: Capability Exchange Protocol',
    difficulty: 'intermediate',
    duration: '20 min',
    desc: 'How JumpNet discovers and communicates with sensor devices.',
    body: `
      <div class="callout">
        <strong>Learning objectives:</strong>
        <ul style="margin:6px 0 0 0">
          <li>Explain why a common device-description protocol is useful in an IoT network.</li>
          <li>Read and write a valid CEP document with <code>device</code> and <code>capabilities</code>.</li>
          <li>Use the JumpNet device API to register, discover, and query devices.</li>
          <li>Run <code>cep.py</code> on a MicroPython board to auto-generate and send a CEP document.</li>
          <li>Use <code>cep.h</code> to do the same on an Arduino / ESP32.</li>
        </ul>
      </div>

      <h3>Why CEP?</h3>
      <p>Imagine a classroom where six groups each have different sensors — one has
      a temperature probe, another a camera, another a light sensor. A JumpNet
      server needs to know which device does what before it can route data correctly.
      Without a common language every device would need custom wiring code on the server.</p>

      <p><strong>CEP (Capability Enumeration Protocol)</strong> solves this with a single
      JSON document that every device produces about itself at startup. The server
      stores it and makes it searchable. Any code that needs "a device with a camera"
      can ask JumpNet to find one — without knowing anything about the hardware in advance.</p>

      <pre><code>Device boots → generates CEP doc → POST /devices/register → JumpNet stores it
                                                             ↕
Any client:  GET /devices/query/provides/camera  ←──────────┘</code></pre>

      <h3>The CEP Document</h3>
      <p>A CEP document is a JSON object with exactly two required top-level keys:</p>

      <pre><code>{
  "device": {
    "id":        "a4:cf:12:7e:00:01",   // unique — MAC address, serial, or UUID
    "class":     "microcontroller",      // "microcontroller" | "computer" | "sensor-node"
    "transport": "network",              // how it connects: "network" | "serial" | "usb" | "ble"
    "model":     "ESP32-S3",             // human-readable board name
    "firmware":  "1.22.0"               // MicroPython / Arduino firmware version
  },
  "capabilities": [
    {
      "type":    "compute",
      "mhz":     240,
      "flash_kb": 4096
    },
    {
      "type":     "sensor",
      "chipset":  "bme280",
      "bus":      "i2c",
      "address":  "0x76",
      "provides": ["temperature", "humidity", "pressure"]
    },
    {
      "type":    "network",
      "mac":     "a4:cf:12:7e:00:01",
      "ip":      "192.168.1.42"
    }
  ]
}</code></pre>

      <p>The <code>capabilities</code> array can have as many entries as needed. Each
      entry must have a <code>type</code> field. The recognised types are:</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <thead>
          <tr style="background:var(--bg-card);text-align:left">
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">type</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">What it describes</th>
            <th style="padding:8px 12px;border-bottom:2px solid var(--border)">Key extra fields</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>compute</code></td><td style="padding:8px 12px;border-bottom:1px solid var(--border)">CPU speed, flash size</td><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>mhz</code>, <code>flash_kb</code></td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>sensor</code></td><td style="padding:8px 12px;border-bottom:1px solid var(--border)">A physical sensor</td><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>chipset</code>, <code>provides</code>, <code>address</code></td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>i2c</code></td><td style="padding:8px 12px;border-bottom:1px solid var(--border)">I²C bus scan results</td><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>buses[ {id, sda, scl, devices_found} ]</code></td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>gpio</code></td><td style="padding:8px 12px;border-bottom:1px solid var(--border)">General-purpose I/O pins</td><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>pins</code></td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>adc</code></td><td style="padding:8px 12px;border-bottom:1px solid var(--border)">Analogue-to-digital inputs</td><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>channels</code>, <code>bits</code></td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>network</code></td><td style="padding:8px 12px;border-bottom:1px solid var(--border)">Wi-Fi / network interface</td><td style="padding:8px 12px;border-bottom:1px solid var(--border)"><code>mac</code>, <code>ip</code>, <code>ssid</code></td></tr>
          <tr><td style="padding:8px 12px"><code>display</code></td><td style="padding:8px 12px">Screen or indicator</td><td style="padding:8px 12px"><code>width</code>, <code>height</code>, <code>driver</code></td></tr>
        </tbody>
      </table>

      <h3>Registering a Device</h3>
      <p>Any device that can make an HTTP POST can register itself:</p>

      <pre><code>POST /devices/register
Content-Type: application/json
&lt;CEP document&gt;

Response 201:
{
  "status":       "registered",
  "id":           "a4:cf:12:7e:00:01",
  "registeredAt": "2026-03-19T09:14:02.000Z"
}</code></pre>

      <p>If the same <code>device.id</code> registers again, the entry is updated in-place
      (useful for devices that reconnect after a power cycle).</p>

      <h3>Discovering Devices</h3>

      <pre><code>// List all registered devices
GET /devices
→ { "count": 3, "devices": [ ... ] }

// Find devices by capability type
GET /devices/query/capability/sensor
→ all devices that have at least one sensor capability

// Find devices by what they measure
GET /devices/query/provides/temperature
→ all devices whose sensors include "temperature" in their provides list

// Get the full CEP doc for one device
GET /devices/a4:cf:12:7e:00:01
→ full CEP document + _registeredAt + _sourceIp

// Remove a device (e.g. when it goes offline)
DELETE /devices/a4:cf:12:7e:00:01
→ { "status": "removed" }</code></pre>

      <h3>MicroPython: Auto-generating Your CEP Document</h3>
      <p>The file <code>clients/micropython/cep.py</code> on your USB drive does all the
      heavy lifting. It:</p>
      <ul>
        <li>Reads the board's unique ID and chip frequency.</li>
        <li>Scans I²C buses for connected chips and matches them against chipset plugins
            (BME280, MPU6050, DS3231, INA219, SSD1306…).</li>
        <li>Reads Wi-Fi interface info if available.</li>
        <li>Assembles the full CEP document and POSTs it to JumpNet.</li>
      </ul>

      <pre><code># On your ESP32 / Pico W  ────────────────────────────────
import network, time
from cep import register_with_jumpnet

# 1. Connect to Wi-Fi first
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("ClassroomWiFi", "password")
while not wlan.isconnected():
    time.sleep(0.5)

# 2. Register — that's it!
result = register_with_jumpnet("http://jumpnet.local:4080")
print(result)  # {"status": "registered", "id": "a4:cf:...", ...}</code></pre>

      <p>The chipset plugins live in <code>clients/micropython/chipsets/</code>.
      Each plugin is a tiny file that declares what I²C address(es) a chip uses and
      what measurements it provides. For example, <code>bme280.py</code>:</p>

      <pre><code># clients/micropython/chipsets/bme280.py
CHIPSET = {
    "name":          "bme280",
    "i2c_addresses": [0x76, 0x77],
    "bus":           "i2c",
    "provides":      ["temperature", "humidity", "pressure"],
}</code></pre>

      <p>If your sensor is not in the list, create a new file following the same pattern
      and add its name to <code>chipsets/__init__.py</code>'s <code>PLUGIN_LIST</code>.</p>

      <h3>Arduino / ESP32: Using cep.h</h3>
      <p>The file <code>clients/arduino/cep.h</code> provides a C++ class that generates
      the same CEP document:</p>

      <pre><code>#include "cep.h"
#include "chipsets/bme280_chip.h"   // optional sensor plugin

CEP cep;

void setup() {
    Serial.begin(115200);
    Wire.begin();

    cep.registerChipset(&bme280Chip);   // add known sensors

    String json = cep.getCapabilitiesJSON();

    // Send to JumpNet  ──────────────────────────────────────
    HTTPClient http;
    http.begin("http://jumpnet.local:4080/devices/register");
    http.addHeader("Content-Type", "application/json");
    int status = http.POST(json);
    Serial.println("Registered: " + String(status));  // 201 = success
    http.end();
}</code></pre>

      <p>On ESP32, the library automatically reads the MAC address (used as the device ID),
      CPU frequency, heap size, flash size, and Wi-Fi details. On plain Arduino boards
      it uses the compile-time board name and I²C scan results.</p>

      <h3>Using the JumpNet Client for Inference</h3>
      <p>Once registered, devices typically also send images for classification.
      <code>clients/micropython/jumpnet.py</code> provides a <code>JumpNetClient</code>
      class:</p>

      <pre><code>from jumpnet import JumpNetClient
import camera  # board-specific camera module

jn = JumpNetClient("http://jumpnet.local:4080")

# Capture a JPEG and classify it
img = camera.capture()
result = jn.infer(img, bundle_id="beads_v1")

print(result["output"])           # e.g. "red"
print(result["confidenceScore"])  # e.g. 0.94</code></pre>

      <h3>The Full Boot Sequence</h3>
      <p>Putting it all together, a typical device boot sequence looks like this:</p>

      <pre><code>1. Board powers on — runs main.py
2. Connect to Wi-Fi
3. register_with_jumpnet(HOST)   ← CEP doc sent once
4. Loop:
     img    = camera.capture()
     result = jn.infer(img, "beads_v1")
     if result["confidenceScore"] >= 0.85:
         sort_bead(result["output"])   # trigger hardware
     time.sleep(0.5)</code></pre>

      <h3>Check Your Understanding</h3>
      <ol>
        <li>What problem does CEP solve? Give a one-sentence explanation.</li>
        <li>What are the two required top-level keys in a CEP document?</li>
        <li>Which field uniquely identifies a device, and what values can it hold?</li>
        <li>Which endpoint would you call to find all devices that measure humidity?</li>
        <li>You wire a new sensor at I²C address 0x48 that measures CO₂.
            What file would you create and what fields must it contain?</li>
        <li>In the Arduino example, what HTTP status code indicates a successful registration?</li>
        <li>A device reboots and calls <code>register_with_jumpnet</code> again with the same ID.
            What happens on the server?</li>
      </ol>

      <div class="callout">
        <strong>You've completed all six lessons!</strong> 🎉
        Head to the <strong>Examples</strong> page to see complete working projects,
        or go straight to <strong>Classify</strong> to try the model live.
      </div>
    `,
  },
];

export function renderLessons(el, _subId, navigate) {
  el.innerHTML = `
    <h1>📚 Lessons</h1>
    <p class="page-subtitle">Structured reading to build your understanding of AI and JumpNet.</p>

    <div style="margin-bottom:16px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn btn-sm btn-secondary filter-btn active" data-diff="all">All</button>
      <button class="btn btn-sm btn-secondary filter-btn" data-diff="beginner">Beginner</button>
      <button class="btn btn-sm btn-secondary filter-btn" data-diff="intermediate">Intermediate</button>
      <button class="btn btn-sm btn-secondary filter-btn" data-diff="advanced">Advanced</button>
    </div>

    <div class="card-grid" id="lessons-grid"></div>
  `;

  const grid = el.querySelector('#lessons-grid');

  function renderGrid(diff) {
    grid.innerHTML = '';
    LESSONS.filter(l => diff === 'all' || l.difficulty === diff).forEach(lesson => {
      const card = document.createElement('a');
      card.className = 'card-link';
      card.href = '#';
      card.innerHTML = `
        <span class="card-icon">${lesson.icon}</span>
        <div class="card-title">${lesson.title}</div>
        <div class="card-desc">${lesson.desc}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="card-badge badge-lesson diff-${lesson.difficulty}">${lesson.difficulty}</span>
          <span style="font-size:12px;color:var(--text-muted)">⏱ ${lesson.duration}</span>
        </div>
      `;
      card.addEventListener('click', e => { e.preventDefault(); navigate('lessons', lesson.id); });
      grid.appendChild(card);
    });
  }

  renderGrid('all');

  el.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid(btn.dataset.diff);
    });
  });
}

export function renderLesson(el, id, navigate) {
  const lesson = LESSONS.find(l => l.id === id);
  if (!lesson) { el.innerHTML = '<p>Lesson not found.</p>'; return; }

  const idx = LESSONS.indexOf(lesson);
  const prev = LESSONS[idx - 1];
  const next = LESSONS[idx + 1];

  el.innerHTML = `
    <a class="back-link" id="back">← Back to Lessons</a>
    <div class="article">
      <h1>${lesson.icon} ${lesson.title}</h1>
      <div class="meta">
        <span class="diff-${lesson.difficulty}">${lesson.difficulty}</span>
        <span>⏱ ${lesson.duration}</span>
      </div>
      ${lesson.body}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:32px;padding-top:20px;border-top:1px solid var(--border);gap:12px;flex-wrap:wrap">
        ${prev
          ? `<a class="btn btn-secondary" id="btn-prev">← ${prev.icon} ${prev.title}</a>`
          : '<span></span>'}
        ${next
          ? `<a class="btn btn-primary" id="btn-next">${next.icon} ${next.title} →</a>`
          : '<a class="btn btn-secondary" id="btn-all">📚 All Lessons</a>'}
      </div>
    </div>
  `;
  el.querySelector('#back').addEventListener('click', e => {
    e.preventDefault(); navigate('lessons');
  });
  if (prev) el.querySelector('#btn-prev').addEventListener('click', e => {
    e.preventDefault(); navigate('lessons', prev.id);
  });
  if (next) el.querySelector('#btn-next').addEventListener('click', e => {
    e.preventDefault(); navigate('lessons', next.id);
  });
  const btnAll = el.querySelector('#btn-all');
  if (btnAll) btnAll.addEventListener('click', e => {
    e.preventDefault(); navigate('lessons');
  });
}
