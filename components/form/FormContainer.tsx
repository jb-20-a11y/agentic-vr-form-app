// Importing HandsFreeMode component
import HandsFreeMode from "./HandsFreeMode";

// ... rest of the code

// Main Content Update
{(viewMode === "hands-free" || viewMode === "both") && (
  <div
    className={
      viewMode === "both"
        ? "w-1/2 border-r border-border"
        : "w-full"
    }
  >
    <HandsFreeMode formSchema={formSchema} />
  </div>
)}
