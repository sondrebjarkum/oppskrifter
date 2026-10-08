<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "../integrations/supabase/supabase-client";

  const CATEGORIES = ["default", "hytta"] as const;
  type Category = (typeof CATEGORIES)[number];

  type Item = {
    id: number;
    title: string;
    completed: boolean;
    added_by: string | null;
    category: string | null;
  };

  type NewItem = {
    title?: string;
    completed?: boolean;
    category?: Category;
  };

  let allItems = $state<Item[]>([]);
  let selectedCategory = $state<Category>("default");
  let loading = $state(true);
  let busy = $state(false);
  let errorMessage = $state("");
  let newTitle = $state("");
  let temporaryId = -1;
  let fetchVersion = 0;

  function categoryOf(item: Item): string {
    return item.category ?? "default";
  }

  function toDbCategory(category: Category): string | null {
    return category === "default" ? null : category;
  }

  const items = $derived(
    allItems.filter((item) => categoryOf(item) === selectedCategory),
  );

  const completedCount = $derived(
    items.filter((item) => item.completed).length,
  );

  const colors = [
    "border border-purple-500/50",
    "border border-lime-500/50",
    "border border-sky-500/50",
    "border border-pink-500/50",
    "border border-fuchsia-500/50",
  ];

  function userBackgroundColor(email: string | null) {
    return colors[(email ?? "").length % colors.length];
  }

  async function getItems() {
    if (busy) return;
    const version = ++fetchVersion;

    const { data, error } = await supabase
      .from("shoppinglistitems")
      .select("*")
      .order("id", { ascending: false });

    // Ignore responses from before a mutation or a newer fetch.
    if (version !== fetchVersion) return;
    if (error) throw error;

    allItems = data ?? [];
  }

  function showError(error: unknown) {
    console.error("Shopping list error:", error);
    errorMessage = "Could not update the shopping list. Please try again.";
  }

  async function refresh() {
    try {
      await getItems();
    } catch (error) {
      showError(error);
    } finally {
      loading = false;
    }
  }

  async function mutate(
    operation: () => PromiseLike<{
      error: { message: string } | null;
    }>,
    optimisticUpdate?: () => void,
  ) {
    if (busy) return;

    const previousItems = allItems;
    busy = true;
    errorMessage = "";
    fetchVersion++;

    try {
      optimisticUpdate?.();

      const { error } = await operation();
      if (error) throw error;
    } catch (error) {
      allItems = previousItems;
      showError(error);
    } finally {
      busy = false;
    }

    await refresh();
  }

  async function addItem({
    title,
    completed = false,
    category = selectedCategory,
  }: NewItem = {}) {
    const trimmedTitle = title?.trim();
    if (!trimmedTitle) return;

    newTitle = "";

    const values = {
      title: trimmedTitle,
      completed,
      added_by: localStorage.getItem("email"),
      category: toDbCategory(category),
    };

    await mutate(
      () => supabase.from("shoppinglistitems").insert(values),
      () => {
        allItems = [{ id: temporaryId--, ...values }, ...allItems];
      },
    );
  }

  async function toggleItemCompleted(item: Item) {
    await mutate(() =>
      supabase
        .from("shoppinglistitems")
        .update({ completed: !item.completed })
        .eq("id", item.id),
    );
  }

  async function deleteItem(id: number) {
    await mutate(() =>
      supabase.from("shoppinglistitems").delete().eq("id", id),
    );
  }

  async function deleteCheckedItems() {
    // Only deletes checked items in the currently selected category
    const ids = items.filter((item) => item.completed).map((item) => item.id);
    if (!ids.length) return;

    await mutate(() =>
      supabase.from("shoppinglistitems").delete().in("id", ids),
    );
  }

  async function handleAdd(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !newTitle.trim()) return;

    await addItem({ title: newTitle });
  }

  onMount(() => {
    const browserWindow = window as Window & {
      shoppingList?: { addItem: typeof addItem };
    };

    const previousShoppingList = browserWindow.shoppingList;
    const api = { addItem };
    browserWindow.shoppingList = api;

    const channel = supabase
      .channel("shoppinglist-svelte")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shoppinglistitems" },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });

    void refresh();

    return () => {
      void supabase.removeChannel(channel);

      if (browserWindow.shoppingList === api) {
        browserWindow.shoppingList = previousShoppingList;
      }
    };
  });
</script>

<div
  class="w-full h-full mx-auto px-0 sm:px-4 py-2 sm:py-8 bg-base flex flex-col border-dashed border-0 sm:border rounded-lg"
>
  <div class="mb-4 w-full">
    <fieldset class="fieldset">
      <legend class="fieldset-legend">Liste</legend>
      <select
        class="select w-full"
        aria-label="Shopping list category"
        bind:value={selectedCategory}
      >
        {#each CATEGORIES as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
    </fieldset>
  </div>
  <div class="mb-7 w-full">
    <form onsubmit={handleAdd}>
      <div class="join w-full">
        <label class="input w-full">
          <input
            type="text"
            placeholder="Buy..."
            class="grow"
            bind:value={newTitle}
          />
        </label>
        <button
          class="btn btn-square"
          title="Add to list"
          disabled={busy || !newTitle.trim()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
            />
          </svg>
        </button>
      </div>
    </form>
  </div>

  <div class="flex justify-between items-center mb-5">
    <span>{completedCount} / {items.length} completed</span>

    <button
      disabled={completedCount === 0}
      onclick={deleteCheckedItems}
      class="btn btn-sm"
    >
      Delete checked
    </button>
  </div>

  {#if errorMessage}
    <p role="alert" class="mb-4 text-red-700">{errorMessage}</p>
  {/if}

  <div
    class="w-full sm:h-[50vh] rounded mb-8 flex-1 shrink basis-auto overflow-x-auto"
    aria-busy={loading}
  >
    {#if loading}
      <div class="skeleton bg-accent-content/10 h-16 w-full mb-1"></div>
      <div class="skeleton bg-accent-content/10 h-16 w-full mb-1"></div>
      <div class="skeleton bg-accent-content/10 h-16 w-full mb-1"></div>
      <div class="skeleton bg-accent-content/10 h-16 w-full mb-1"></div>
      <div class="skeleton bg-accent-content/10 h-16 w-full mb-1"></div>
    {:else}
      {#each items as item, index (item.id)}
        <div
          class="flex items-center justify-between py-4 border-base-content/20"
          class:border-b={index < items.length - 1}
        >
          <label class="flex items-center gap-2">
            <input
              class="checkbox checkbox-sm"
              type="checkbox"
              checked={item.completed}
              onchange={() => toggleItemCompleted(item)}
            />
            <span class:line-through={item.completed}>{item.title}</span>
          </label>

          <div class="text-center flex gap-4 items-center">
            <div
              class="badge badge-soft badge-sm ${userBackgroundColor(
                item.added_by,
              )}"
            >
              {item.added_by?.split("@")[0] ?? "Unknown"}
            </div>
            <button
              aria-label={`Delete ${item.title}`}
              class="btn btn-ghost btn-square"
              onclick={() => deleteItem(item.id)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      {:else}
        <p>Your shopping list is empty.</p>
      {/each}
    {/if}
  </div>
</div>
