import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders as a button by default", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders as a child component", () => {
    render(
      <Button asChild>
        <a href="/">Home</a>
      </Button>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });
});
