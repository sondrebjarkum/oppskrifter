import { defineHastPlugin } from "satteri";

function textOf(node: any) {
  if (node.type === "text") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

export default function satteriIngredients({ heading = /^ingredienser$/i } = {}) {
  let inIngredients = false;

  return defineHastPlugin({
    name: "satteri-ingredients",
    element: {
      filter: ["h2", "ul"],
      visit(node, ctx) {
        if (node.tagName === "h2") {
          inIngredients = heading.test(textOf(node).trim());
          return;
        }

        if (inIngredients && node.tagName === "ul") {
          ctx.setProperty(node, "data-ingredients", "");
        }
      },
    },
  });
}
