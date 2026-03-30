<template>
  <main class="landing-page">
    <section class="hero">
      <p class="eyebrow">Under construction</p>
      <h1>Coming soon</h1>
      <p class="message">
        We&rsquo;re building the new Organization Tools website. Please check back soon for the
        full launch.
      </p>
    </section>
  </main>
</template>

<style scoped>
.landing-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 2rem;
}

.hero {
  width: min(100%, 34rem);
  text-align: center;
}

.eyebrow {
  margin: 0 0 1rem;
  color: #2563eb;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(3rem, 10vw, 5.5rem);
  font-weight: 700;
  letter-spacing: -0.06em;
  line-height: 0.95;
}

.message {
  margin: 1.5rem 0 0;
  color: #475569;
  font-size: 1.05rem;
  line-height: 1.7;
}
</style>
