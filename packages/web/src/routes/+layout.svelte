
<script lang="ts">
        import '../app.css';
        import favicon from '$lib/assets/favicon.svg';
        import { onMount } from 'svelte';
        import { onNavigate } from '$app/navigation';
        import { page } from '$app/state';
        import AppHeader from '$lib/components/organisms/AppHeader.svelte';
        import AppFooter from '$lib/components/organisms/AppFooter.svelte';
        import { APP_NAME } from '$lib/config';

        let { children } = $props();

        type Theme = 'light' | 'dark';
        let theme = $state<Theme>('light');

        function applyTheme(value: Theme) {
                theme = value;
                document.documentElement.classList.toggle('dark', value === 'dark');
                document.documentElement.style.colorScheme = value;
                localStorage.setItem('cloakmail-theme', value);
        }

        function toggleTheme() {
                applyTheme(theme === 'dark' ? 'light' : 'dark');
        }

        onMount(() => {
                const savedTheme = localStorage.getItem('cloakmail-theme');

                const initialTheme: Theme =
                        savedTheme === 'dark' || savedTheme === 'light'
                                ? savedTheme
                                : window.matchMedia('(prefers-color-scheme: dark)').matches
                                        ? 'dark'
                                        : 'light';

                applyTheme(initialTheme);
        });

        onNavigate((navigation) => {
                if (!document.startViewTransition) return;
                return new Promise((resolve) => {
                        document.startViewTransition(async () => {
                                resolve();
                                await navigation.complete;
                        });
                });
        });

        let isHomePage = $derived(page.url.pathname === '/');
</script>

<svelte:head>
        <link rel="icon" href={favicon} />
        <title>{APP_NAME}</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-start p-4 md:p-6 lg:p-8">
        <AppHeader
                showGenerate={!isHomePage}
                {theme}
                onToggleTheme={toggleTheme}
        />

        <main style="view-transition-name: main-content" class="w-full max-w-6xl grow">
                {@render children()}
        </main>

        <AppFooter />
</div>
