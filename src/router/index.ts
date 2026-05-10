import { createRouter, createWebHistory } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import MainLayout from '@/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: DefaultLayout,
      children: [
        { path: '', component: () => import('@/pages/HomeView.vue') },
      ],
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: 'test', component: () => import('@/pages/TestView.vue') },
      ],
    },
  ],
})

export default router
