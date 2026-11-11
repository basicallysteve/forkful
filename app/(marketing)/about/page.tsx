import type { Metadata } from 'next'
import styles from './page.module.scss'

export const metadata: Metadata = {
  title: 'About',
  description: 'EatForkful is a recipe manager, pantry tracker, and food log built for people who actually cook.',
  openGraph: {
    title: 'About EatForkful',
    description: 'EatForkful is a recipe manager, pantry tracker, and food log built for people who actually cook.',
    images: [{ url: '/og-default.png' }],
  },
}

export default function AboutPage() {
  return (
    <article className={styles.article}>
      <h1>About EatForkful</h1>
      <p className={styles.lead}>
        We built EatForkful because great recipes deserve more than a scroll.
      </p>
      <p>
        The internet is full of food content. Most of it is noise — bloated posts, generic suggestions, recipes you can’t trust. EatForkful is different. It’s a place where serious home cooks find recipes worth making, and where the people who create them get paid for their craft.
      </p>
      <h2>Food knowledge should be owned, not just shared.</h2>
      <p>
        Creators spend hours developing, testing, and perfecting recipes. Platforms have spent years treating that work as free content. We think that’s wrong.
      </p>
      <p>
        EatForkful is built on a simple idea: the best recipes come from real kitchens, and the people behind them deserve a sustainable way to share their work with the world.
      </p>
      <h2>It started in our kitchen.</h2>
      <p>
        My wife and I cook — a lot. It’s one of the things we do together, and over time it became one of the things we care about getting right.
      </p>
      <p>
        But the more seriously we cooked, the more friction we ran into. Recipes scattered everywhere. Ingredients bought twice because we couldn’t remember what was already in the pantry. Food going to waste because nothing connected what we had to what we were making. And for me personally, a gap between the meals we were cooking and the nutrition tracking I was doing for my health — two habits that should talk to each other, but never did.
      </p>
      <p>I looked for an app that could hold all of that together. I couldn’t find one. So I built EatForkful.</p>
      <h2>A kitchen companion that actually knows your kitchen.</h2>
      <p>
        EatForkful isn’t just a recipe box. It tracks what you have, connects ingredients to what you can make, and helps you understand what you’re eating — without turning cooking into a chore.
      </p>
      <p>
        Whether you’re feeding yourself on a Tuesday or hosting a dinner you’ve been planning for a week, EatForkful is built around the way you actually cook.
      </p>
      <h2>Your recipes. Your audience. Your space.</h2>
      <p>
        If you’re a recipe creator, EatForkful gives you a home built around the work you actually do. Share your recipes with an audience that’s here specifically to cook them — not to scroll past them. No noise, no algorithm chasing. Just your food, and the people who want to make it.
      </p>
      <h2>Built for the people who take cooking seriously.</h2>
      <p>
        EatForkful is for the cook who dog-ears cookbooks, who adjusts recipes until they’re right, and who thinks a good meal is worth the effort. And it’s for the creator who knows that effort deserves recognition.
      </p>
      <p>We’re just getting started. Come cook with us.</p>
    </article>
  )
}
