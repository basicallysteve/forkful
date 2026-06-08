import Link from 'next/link'
import RecipeCard from '@/components/RecipeCard/RecipeCard'
import type { Recipe } from '@/types/Recipe'
import type { PantryItem } from '@/types/PantryItem'
import styles from './Home.module.scss'

interface HomeProps {
  isAuthenticated: boolean
  username?: string
  recipes: Recipe[]
  expiringItems?: PantryItem[]
}

function formatExpiry(date: Date | null): string {
  if (!date) return ''
  const now = new Date()
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'Expired'
  if (diff === 0) return 'Expires today'
  if (diff === 1) return 'Expires tomorrow'
  return `Expires in ${diff} days`
}

function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <h1 className={styles.heroHeadline}>Your kitchen, organised.</h1>
        <p className={styles.heroSubheadline}>
          Discover recipes, track your pantry, and log your meals — all in one place.
        </p>
        <div className={styles.heroCtas}>
          <Link href="/create-account" className="primary-button">Get started free</Link>
          <Link href="/login" className={styles.loginLink}>Already have an account? Log in</Link>
        </div>
      </div>
    </section>
  )
}

function FeatureCallouts() {
  const features = [
    {
      icon: 'pi pi-book',
      title: 'Recipes',
      description: 'Browse and save recipes from the community, or create your own.',
    },
    {
      icon: 'pi pi-box',
      title: 'Pantry tracker',
      description: 'Know what\'s in your fridge and get alerts before things expire.',
    },
    {
      icon: 'pi pi-chart-bar',
      title: 'Food log',
      description: 'Track your daily meals and see your nutritional breakdown at a glance.',
    },
  ]

  return (
    <section className={styles.features}>
      {features.map((f) => (
        <div key={f.title} className={styles.featureCard}>
          <i className={`${f.icon} ${styles.featureIcon}`} />
          <h3 className={styles.featureTitle}>{f.title}</h3>
          <p className={styles.featureDescription}>{f.description}</p>
        </div>
      ))}
    </section>
  )
}

function PantryWidget({ items }: { items: PantryItem[] }) {
  return (
    <div className={styles.widget}>
      <h3 className={styles.widgetTitle}>Expiring soon</h3>
      {items.length === 0 ? (
        <p className={styles.widgetEmpty}>Nothing expiring in the next 7 days.</p>
      ) : (
        <ul className={styles.pantryList}>
          {items.map((item) => (
            <li key={item.id} className={styles.pantryItem}>
              <span className={styles.pantryName}>{item.food.name}</span>
              <span className={`${styles.pantryExpiry} ${item.status === 'expired' ? styles.expired : styles.expiringSoon}`}>
                {formatExpiry(item.expirationDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/pantry" className={styles.widgetLink}>View pantry</Link>
    </div>
  )
}

function FoodLogWidget() {
  const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
  return (
    <div className={styles.widget}>
      <div className={styles.widgetTitleRow}>
        <h3 className={styles.widgetTitle}>Food log</h3>
        <span className={styles.comingSoonBadge}>Coming soon</span>
      </div>
      <ul className={styles.mealSlots}>
        {meals.map((meal) => (
          <li key={meal} className={styles.mealSlot}>
            <span className={styles.mealName}>{meal}</span>
            <span className={styles.mealEmpty}>— nothing logged</span>
          </li>
        ))}
      </ul>
      <p className={styles.widgetCta}>Food logging is coming soon. Stay tuned!</p>
    </div>
  )
}

function ValueSavedWidget() {
  return (
    <div className={styles.widget}>
      <div className={styles.widgetTitleRow}>
        <h3 className={styles.widgetTitle}>Value saved</h3>
        <span className={styles.comingSoonBadge}>Coming soon</span>
      </div>
      <div className={styles.valueSavedAmount}>$0.00</div>
      <p className={styles.valueSavedLabel}>saved this month by cooking at home</p>
      <p className={styles.widgetCta}>Track your savings once food logging is live.</p>
    </div>
  )
}

export default function Home({ isAuthenticated, username, recipes, expiringItems = [] }: HomeProps) {
  if (!isAuthenticated) {
    return (
      <div className={styles.page}>
        <HeroSection />
        <FeatureCallouts />
        <section className={styles.publicRecipes}>
          <h2 className={styles.sectionTitle}>Popular recipes</h2>
          {recipes.length === 0 ? (
            <p className={styles.emptyText}>No recipes available yet.</p>
          ) : (
            <div className={styles.recipeCards} data-count={recipes.length}>
              {recipes.map((recipe, index) => (
                <div key={recipe.id} className={styles.recipeCardWrapper}>
                  {index === 0 && <span className={styles.topBadge}><i className="pi pi-sparkles" /> Most popular</span>}
                  <RecipeCard recipe={recipe} />
                </div>
              ))}
            </div>
          )}
          <Link href="/recipes" className="ghost-button">Browse all recipes</Link>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.dashboardHeading}>Welcome back, {username}!</h1>

      <section className={styles.dashboardRecipes}>
        <h2 className={styles.sectionTitle}>Recently saved recipes</h2>
        {recipes.length === 0 ? (
          <p className={styles.emptyText}>No saved recipes yet. <Link href="/recipes">Browse recipes</Link> and save the ones you love!</p>
        ) : (
          <div className={styles.recipeCards}>
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
        <Link href="/recipes" className="ghost-button">Browse all recipes</Link>
      </section>

      <div className={styles.widgetGrid}>
        <PantryWidget items={expiringItems} />
        <FoodLogWidget />
        <ValueSavedWidget />
      </div>
    </div>
  )
}
