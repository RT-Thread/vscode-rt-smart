<template>
  <div class="common-layout">
    <Banner sub-title="设置" />

      <el-aside>
        <el-menu
          :collapse="isSidebarOpen"
          :collapse-transition="false"
          router
          :default-active="activeMenu"
          style="border: none"
          mode="horizontal"
        >
          <el-menu-item
            v-for="item in list"
            :key="item.path"
            :index="item.redirect || item.path"
            :route="item.redirect || item.path"
          >
            <span class="title">{{ item.meta.title }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container class="container_main">
        <el-main class="main_box">
          <router-view></router-view>
        </el-main>
      </el-container>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { routes } from '../../router';
import { extensionInfo } from '../../data';
import { imgUrl } from '../../../assets/img'
import Banner from '../../../components/Banner.vue';

interface MenuRoute {
    path: string
    redirect?: string
    children: any
    meta: any
}

const route = useRoute()
const router = useRouter()
const isSidebarOpen = ref(false)

type ListItemType = MenuRoute & { icon?: string }
const list: any = computed(() => {
    return getMenuList(routes)
})

const activeMenu = ref('/environment')

const resolveActivePath = (path?: string): string => {
    if (!path || path === '/') {
        return '/environment'
    }
    return path
}

onMounted(() => {
    const resolvedPath = resolveActivePath(route.path)
    activeMenu.value = resolvedPath
    if (resolvedPath !== route.path) {
        router.replace(resolvedPath)
    }
})

watch(
    () => route.path,
    (newPath) => {
        activeMenu.value = resolveActivePath(newPath)
    }
)

const getMenuList = (list: MenuRoute[], basePath?: string): ListItemType[] => {
    if (!list || list.length === 0) {
        return []
    }
    list.sort((a, b) => {
        return (a.meta?.orderNo || 0) - (b.meta?.orderNo || 0)
    })
    return list
        .map((item) => {
            const path =
                basePath && !item.path.includes(basePath)
                    ? `${basePath}/${item.path}`
                    : item.path
            return {
                path,
                title: item.meta?.title,
                icon: item.meta?.icon,
                children: getMenuList(item.children, path),
                meta: item.meta,
                redirect: item.redirect
            }
        })
        .filter((item) => item.meta && item.meta.hidden !== true)
}
</script>

<style scoped>
@import './index.less';
</style>
